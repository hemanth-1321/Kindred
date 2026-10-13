import type { LlmClient } from "./client.js";
import { CONVERSATION_PROMPT, CONVERSATION_PROMPT_VERSION } from "./prompts.js";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationReply = {
  content: string;
  model: string;
  promptVersion: string;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

export async function generateConversationReply(
  client: LlmClient,
  model: string,
  history: ChatTurn[],
): Promise<ConversationReply> {
  const startedAt = performance.now();
  const response = await client.responses.create({
    model,
    instructions: CONVERSATION_PROMPT,
    input: history.map((turn) => ({ role: turn.role, content: turn.content })),
    // Conversations are private; do not retain them on the provider side.
    store: false,
  });

  const content = response.output_text.trim();
  if (!content) {
    throw new Error(
      `Empty reply from model (status: ${response.status ?? "unknown"})`,
    );
  }

  return {
    content,
    model: response.model,
    promptVersion: CONVERSATION_PROMPT_VERSION,
    providerRequestId: response._request_id ?? null,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
