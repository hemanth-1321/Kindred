import { createOpenAIClient, type LlmClient } from "@repo/llm";
import { env } from "./env.js";
import { HttpError } from "./http-error.js";

let client: LlmClient | undefined;

export function getLlmClient(): LlmClient {
  if (!env.openaiApiKey) {
    throw new HttpError(503, "OPENAI_API_KEY is not configured");
  }
  client ??= createOpenAIClient(env.openaiApiKey);
  return client;
}
