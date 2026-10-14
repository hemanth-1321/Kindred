import {
  conversationMessages,
  conversations,
  profileAssertions,
  type ProfileExtractPayload,
  usageEvents,
  users,
} from "@repo/db";
import type { FollowUp } from "@repo/llm";
import { isListField, type ValidatedAssertion } from "@repo/matching";
import { and, asc, desc, eq, gt, isNull, lte, max } from "drizzle-orm";
import { db } from "../db.js";
import { env } from "../env.js";
import { getLlmClient } from "../llm.js";
import { extractProfile } from "./extract.js";

const BATCH_SIZE = 40;
const CONTEXT_SIZE = 6;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type CurrentAssertion = Awaited<
  ReturnType<typeof loadCurrentAssertions>
>[number];

export async function runProfileExtraction(
  payload: ProfileExtractPayload,
): Promise<string> {
  const { conversationId, userId, sequence } = payload;

  const [latest] = await db
    .select({ sequence: max(conversationMessages.sequence) })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.role, "user"),
      ),
    );
  if ((latest?.sequence ?? 0) > sequence) {
    return "skipped: a newer message will trigger extraction";
  }

  let batches = 0;
  for (;;) {
    const outcome = await extractNextBatch(conversationId, userId);
    if (outcome !== "extracted") {
      return batches === 0 ? outcome : `extracted ${batches} batch(es)`;
    }
    batches += 1;
  }
}

async function extractNextBatch(
  conversationId: string,
  userId: string,
): Promise<string> {
  const [conversation] = await db
    .select({
      version: conversations.version,
      cursor: conversations.profileExtractedThrough,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    );
  if (!conversation) return "skipped: conversation not found";
  const { cursor } = conversation;

  const messageColumns = {
    id: conversationMessages.id,
    role: conversationMessages.role,
    content: conversationMessages.content,
    sequence: conversationMessages.sequence,
    createdAt: conversationMessages.createdAt,
  };
  const batch = await db
    .select(messageColumns)
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        gt(conversationMessages.sequence, cursor),
      ),
    )
    .orderBy(asc(conversationMessages.sequence))
    .limit(BATCH_SIZE);
  if (batch.length === 0) return "skipped: nothing new";
  const through = batch.at(-1)!.sequence;

  const turns = batch.filter((m) => m.role !== "system");
  if (!turns.some((m) => m.role === "user")) {
    await commit(conversationId, cursor, through, async () => {});
    return "extracted";
  }

  const context = await db
    .select(messageColumns)
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        lte(conversationMessages.sequence, cursor),
      ),
    )
    .orderBy(desc(conversationMessages.sequence))
    .limit(CONTEXT_SIZE);

  const existing = await loadCurrentAssertions(db, userId);
  const result = await extractProfile(getLlmClient(), env.extractionModel, {
    existing: existing.map(({ id, subject, field, value, status }) => ({
      id,
      subject,
      field,
      value,
      status,
    })),
    context: context
      .reverse()
      .filter((m) => m.role !== "system")
      .map(toTranscript),
    messages: turns.map(toTranscript),
  });

  await db.insert(usageEvents).values({
    userId,
    purpose: "profile_extraction",
    provider: "openai",
    model: result.usage.model,
    providerRequestId: result.usage.providerRequestId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    latencyMs: result.usage.latencyMs,
  });
  if (result.rejected.length > 0) {
    console.warn(
      `profile extraction rejected ${result.rejected.length} assertion(s)`,
      result.rejected.map((r) => `${r.proposal.field}: ${r.reason}`),
    );
  }

  const createdAtById = new Map(batch.map((m) => [m.id, m.createdAt]));
  const committed = await commit(
    conversationId,
    cursor,
    through,
    async (tx) => {
      if (result.under18) {
        await tx
          .update(users)
          .set({ adultEligible: false })
          .where(eq(users.id, userId));
        return ["under_18"];
      }
      const current = await loadCurrentAssertions(tx, userId);
      for (const assertion of result.accepted) {
        await applyAssertion(tx, {
          userId,
          assertion,
          current,
          observedAt: latestEvidenceTime(assertion.evidence, createdAtById),
          conversationVersion: conversation.version,
        });
      }
      return result.followUps;
    },
  );
  return committed ? "extracted" : "skipped: another job extracted first";
}

/** Advances the cursor only if no other job moved it, then applies the batch in the same transaction. */
async function commit(
  conversationId: string,
  expectedCursor: number,
  through: number,
  apply: (tx: Tx) => Promise<FollowUp[] | void>,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({
        cursor: conversations.profileExtractedThrough,
        pendingQuestions: conversations.pendingQuestions,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for("update");
    if (!locked || locked.cursor !== expectedCursor) return false;

    const followUps = (await apply(tx)) ?? [];
    const pendingQuestions = await reconcileQuestions(
      tx,
      locked.userId,
      locked.pendingQuestions,
      followUps,
    );
    await tx
      .update(conversations)
      .set({ profileExtractedThrough: through, pendingQuestions })
      .where(eq(conversations.id, conversationId));
    return true;
  });
}

async function applyAssertion(
  tx: Tx,
  input: {
    userId: string;
    assertion: ValidatedAssertion;
    current: CurrentAssertion[];
    observedAt: Date;
    conversationVersion: number;
  },
) {
  const { userId, assertion, current, observedAt, conversationVersion } = input;
  const sameField = current.filter(
    (c) => c.subject === assertion.subject && c.field === assertion.field,
  );

  let value = assertion.value;
  if (isListField(assertion.field)) {
    const known = new Set(
      sameField.flatMap((c) => (c.value as string[]).map(normalize)),
    );
    const added = (value as string[]).filter((v) => !known.has(normalize(v)));
    if (added.length === 0) return;
    value = added;
  } else if (sameField.some((c) => sameValue(c.value, value))) {
    return;
  }

  // Without an explicit correction, a different value for a single-valued field
  // is a conflict to ask about, never a silent overwrite.
  const conflicting = isListField(assertion.field)
    ? []
    : sameField.filter(
        (c) => c.id !== assertion.supersedes && !sameValue(c.value, value),
      );
  const status = conflicting.length > 0 ? "contradicted" : assertion.status;

  const [inserted] = await tx
    .insert(profileAssertions)
    .values({
      userId,
      subject: assertion.subject,
      field: assertion.field,
      value,
      evidenceMessageIds: assertion.evidence,
      status,
      isHardConstraint: assertion.proposedHardConstraint,
      importance: assertion.importance,
      observedAt,
      sourceConversationVersion: conversationVersion,
    })
    .returning({ id: profileAssertions.id });

  if (assertion.supersedes) {
    await tx
      .update(profileAssertions)
      .set({ supersededAt: new Date(), supersededById: inserted!.id })
      .where(
        and(
          eq(profileAssertions.id, assertion.supersedes),
          eq(profileAssertions.userId, userId),
        ),
      );
  }
  for (const old of conflicting) {
    await tx
      .update(profileAssertions)
      .set({ status: "contradicted" })
      .where(eq(profileAssertions.id, old.id));
  }
  current.push({
    id: inserted!.id,
    subject: assertion.subject,
    field: assertion.field,
    value,
    status,
  });
}

/** Keeps questions until the profile answers them; contradictions stay open while any remain. */
async function reconcileQuestions(
  tx: Tx,
  userId: string,
  previous: string[],
  added: FollowUp[],
): Promise<string[]> {
  const current = await loadCurrentAssertions(tx, userId);
  const has = (subject: string, field: string) =>
    current.some((a) => a.subject === subject && a.field === field);
  const answered: Record<string, boolean> = {
    ask_birth_date: has("self", "birth_date"),
    ask_gender: has("self", "gender"),
    resolve_contradiction: !current.some((a) => a.status === "contradicted"),
    under_18: false,
  };
  return [...new Set([...previous, ...added])].filter((q) => !answered[q]);
}

function loadCurrentAssertions(executor: typeof db | Tx, userId: string) {
  return executor
    .select({
      id: profileAssertions.id,
      subject: profileAssertions.subject,
      field: profileAssertions.field,
      value: profileAssertions.value,
      status: profileAssertions.status,
    })
    .from(profileAssertions)
    .where(
      and(
        eq(profileAssertions.userId, userId),
        isNull(profileAssertions.supersededAt),
      ),
    );
}

function toTranscript(message: { id: string; role: string; content: string }) {
  return {
    id: message.id,
    role: message.role as "user" | "assistant",
    content: message.content,
  };
}

function latestEvidenceTime(
  evidence: string[],
  createdAtById: Map<string, Date>,
) {
  const times = evidence
    .map((id) => createdAtById.get(id)?.getTime())
    .filter((t): t is number => t !== undefined);
  return new Date(times.length > 0 ? Math.max(...times) : Date.now());
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value: unknown): unknown {
  if (typeof value === "string") return normalize(value);
  if (Array.isArray(value)) return value.map(canonical).map(String).sort();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return value;
}
