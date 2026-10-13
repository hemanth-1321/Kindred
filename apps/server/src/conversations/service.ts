import {
  conversationMessages,
  conversations,
  usageEvents,
  type Db,
} from "@repo/db";
import { generateConversationReply, type ConversationReply } from "@repo/llm";
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import { env } from "../env.js";
import { HttpError } from "../http-error.js";
import { getLlmClient } from "../llm.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const HISTORY_LIMIT = 40;

const messageColumns = {
  id: conversationMessages.id,
  role: conversationMessages.role,
  content: conversationMessages.content,
  sequence: conversationMessages.sequence,
  inputMode: conversationMessages.inputMode,
  idempotencyKey: conversationMessages.idempotencyKey,
  createdAt: conversationMessages.createdAt,
};

const conversationColumns = {
  id: conversations.id,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
};

type Message = NonNullable<Awaited<ReturnType<typeof findMessageByKey>>>;

// Shares one model call between concurrent retries on this API instance;
// the unique idempotency key still guarantees a single stored reply across instances.
const repliesInFlight = new Map<string, Promise<Message>>();

export async function listConversations(userId: string) {
  return db
    .select(conversationColumns)
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function createConversation(userId: string) {
  const [conversation] = await db
    .insert(conversations)
    .values({ userId })
    .returning(conversationColumns);
  return conversation!;
}

export async function listMessages(conversationId: string, userId: string) {
  await requireOwnedConversation(db, conversationId, userId);
  return db
    .select(messageColumns)
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.sequence));
}

export async function sendMessage(input: {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
  onDelta?: (text: string) => void;
}) {
  const { conversationId, userId, content, idempotencyKey, onDelta } = input;

  const userMessage = await db.transaction(async (tx) => {
    await requireOwnedConversation(tx, conversationId, userId, {
      lock: true,
    });
    const existing = await findMessageByKey(tx, conversationId, idempotencyKey);
    if (existing) {
      if (existing.content !== content) {
        throw new HttpError(
          409,
          "idempotencyKey was already used for a different message",
        );
      }
      return existing;
    }
    const [inserted] = await tx
      .insert(conversationMessages)
      .values({
        conversationId,
        userId,
        role: "user",
        content,
        sequence: await nextSequence(tx, conversationId),
        inputMode: "text",
        idempotencyKey,
      })
      .returning(messageColumns);
    await tx
      .update(conversations)
      .set({ version: sql`${conversations.version} + 1` })
      .where(eq(conversations.id, conversationId));
    return inserted!;
  });

  const replyKey = `${idempotencyKey}:reply`;
  const existingReply = await findMessageByKey(db, conversationId, replyKey);
  if (existingReply) {
    return { userMessage, assistantMessage: existingReply };
  }

  // A concurrent retry joins the in-flight reply without its deltas and gets
  // the full message once it is stored.
  const inFlightKey = `${conversationId}:${replyKey}`;
  let pending = repliesInFlight.get(inFlightKey);
  if (!pending) {
    pending = produceReply({
      conversationId,
      userId,
      replyKey,
      upToSequence: userMessage.sequence,
      onDelta,
    }).finally(() => repliesInFlight.delete(inFlightKey));
    repliesInFlight.set(inFlightKey, pending);
  }

  return { userMessage, assistantMessage: await pending };
}

async function produceReply(input: {
  conversationId: string;
  userId: string;
  replyKey: string;
  upToSequence: number;
  onDelta?: (text: string) => void;
}): Promise<Message> {
  const { conversationId, userId, replyKey, upToSequence, onDelta } = input;

  const history = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        lte(conversationMessages.sequence, upToSequence),
      ),
    )
    .orderBy(desc(conversationMessages.sequence))
    .limit(HISTORY_LIMIT);

  let reply: ConversationReply;
  try {
    reply = await generateConversationReply(
      getLlmClient(),
      env.openaiChatModel,
      history
        .reverse()
        .filter((turn) => turn.role !== "system")
        .map((turn) => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        })),
      { onDelta },
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "The assistant could not reply. Retry with the same idempotencyKey.",
      { cause: error },
    );
  }

  await db.insert(usageEvents).values({
    userId,
    purpose: "conversation",
    provider: "openai",
    model: reply.model,
    providerRequestId: reply.providerRequestId,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
    latencyMs: reply.latencyMs,
  });

  return db.transaction(async (tx) => {
    await requireOwnedConversation(tx, conversationId, userId, {
      lock: true,
    });
    const existing = await findMessageByKey(tx, conversationId, replyKey);
    if (existing) return existing;
    const [inserted] = await tx
      .insert(conversationMessages)
      .values({
        conversationId,
        userId,
        role: "assistant",
        content: reply.content,
        sequence: await nextSequence(tx, conversationId),
        idempotencyKey: replyKey,
      })
      .returning(messageColumns);
    return inserted!;
  });
}

async function requireOwnedConversation(
  executor: Db | Tx,
  conversationId: string,
  userId: string,
  options: { lock?: boolean } = {},
) {
  const query = executor
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    );
  const [conversation] = options.lock ? await query.for("update") : await query;
  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }
}

async function findMessageByKey(
  executor: Db | Tx,
  conversationId: string,
  idempotencyKey: string,
) {
  const [message] = await executor
    .select(messageColumns)
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.idempotencyKey, idempotencyKey),
      ),
    );
  return message;
}

async function nextSequence(tx: Tx, conversationId: string) {
  const [row] = await tx
    .select({
      next: sql<number>`coalesce(max(${conversationMessages.sequence}), 0) + 1`.mapWith(
        Number,
      ),
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));
  return row!.next;
}
