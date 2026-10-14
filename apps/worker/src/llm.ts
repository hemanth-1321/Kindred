import { createOpenAIClient, type LlmClient } from "@repo/llm";
import { env } from "./env.js";

let client: LlmClient | undefined;

export function getLlmClient(): LlmClient {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  client ??= createOpenAIClient(env.openaiApiKey);
  return client;
}
