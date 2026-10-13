import type OpenAI from "openai";
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
  options: { onDelta?: (text: string) => void } = {},
): Promise<ConversationReply> {
  const startedAt = performance.now();
  const { data: stream, request_id } = await client.responses
    .create({
      model,
      instructions: CONVERSATION_PROMPT,
      input: history.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      // Conversations are private; do not retain them on the provider side.
      store: false,
      stream: true,
    })
    .withResponse();

  let text = "";
  let completed: OpenAI.Responses.Response | null = null;
  for await (const event of stream) {
    switch (event.type) {
      case "response.output_text.delta":
        text += event.delta;
        options.onDelta?.(event.delta);
        break;
      case "response.completed":
        completed = event.response;
        break;
      case "response.failed":
        throw new Error(
          `Model response failed: ${event.response.error?.message ?? "unknown error"}`,
        );
      case "response.incomplete":
        throw new Error(
          `Model response incomplete: ${event.response.incomplete_details?.reason ?? "unknown reason"}`,
        );
      case "error":
        throw new Error(`Model stream error: ${event.message}`);
    }
  }

  const content = text.trim();
  if (!completed || !content) {
    throw new Error("Model stream ended without a reply");
  }

  return {
    content,
    model: completed.model,
    promptVersion: CONVERSATION_PROMPT_VERSION,
    providerRequestId: request_id,
    inputTokens: completed.usage?.input_tokens ?? null,
    outputTokens: completed.usage?.output_tokens ?? null,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
