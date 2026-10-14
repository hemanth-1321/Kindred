import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { LlmClient } from "./client.js";
import {
  PROFILE_EXTRACTION_PROMPT,
  PROFILE_EXTRACTION_PROMPT_VERSION,
} from "./prompts.js";

export const FOLLOW_UPS = [
  "ask_birth_date",
  "ask_gender",
  "resolve_contradiction",
  "under_18",
] as const;

export type FollowUp = (typeof FOLLOW_UPS)[number];

export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ExistingAssertion = {
  id: string;
  subject: "self" | "desired_partner";
  field: string;
  value: unknown;
  status: string;
};

export type ProposedProfileAssertion = {
  subject: "self" | "desired_partner";
  field: string;
  value: unknown;
  status: "explicit" | "inferred" | "contradicted";
  importance: "low" | "medium" | "high" | null;
  proposedHardConstraint: boolean;
  evidence: string[];
  supersedes: string | null;
  conflictsWith: string | null;
};

export type ProfileExtraction = {
  assertions: ProposedProfileAssertion[];
  followUps: FollowUp[];
  under18: boolean;
  model: string;
  promptVersion: string;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

function outputSchema(fieldNames: readonly [string, ...string[]]) {
  return z.object({
    assertions: z.array(
      z.object({
        subject: z.enum(["self", "desired_partner"]),
        field: z.enum(fieldNames),
        value: z.union([
          z.string(),
          z.number(),
          z.array(z.string()),
          z.object({ min: z.number(), max: z.number() }),
        ]),
        status: z.enum(["explicit", "inferred", "contradicted"]),
        importance: z.enum(["low", "medium", "high"]).nullable(),
        proposed_hard_constraint: z.boolean(),
        evidence: z.array(z.string()),
        supersedes: z.string().nullable(),
        conflicts_with: z.string().nullable(),
      }),
    ),
    follow_ups: z.array(z.enum(FOLLOW_UPS)),
    under_18: z.boolean(),
  });
}

export async function extractProfileAssertions(
  client: LlmClient,
  model: string,
  input: {
    fieldNames: readonly [string, ...string[]];
    fieldGuide: string;
    existing: ExistingAssertion[];
    context: TranscriptMessage[];
    messages: TranscriptMessage[];
  },
): Promise<ProfileExtraction> {
  const startedAt = performance.now();
  const response = await client.responses.parse({
    model,
    instructions: PROFILE_EXTRACTION_PROMPT + input.fieldGuide,
    input: JSON.stringify({
      existing_assertions: input.existing,
      context_messages: input.context,
      new_messages: input.messages,
    }),
    text: {
      format: zodTextFormat(
        outputSchema(input.fieldNames),
        "profile_extraction",
      ),
    },
    store: false,
  });

  const output = response.output_parsed;
  if (!output) {
    throw new Error(
      `Profile extraction returned no structured output (status: ${response.status ?? "unknown"})`,
    );
  }

  return {
    assertions: output.assertions.map((a) => ({
      subject: a.subject,
      field: a.field,
      value: a.value,
      status: a.status,
      importance: a.importance,
      proposedHardConstraint: a.proposed_hard_constraint,
      evidence: a.evidence,
      supersedes: a.supersedes,
      conflictsWith: a.conflicts_with,
    })),
    followUps: [...new Set(output.follow_ups)],
    under18: output.under_18,
    model: response.model,
    promptVersion: PROFILE_EXTRACTION_PROMPT_VERSION,
    providerRequestId: response._request_id ?? null,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
