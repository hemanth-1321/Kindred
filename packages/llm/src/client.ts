import OpenAI from "openai";

export type LlmClient = OpenAI;

export function createOpenAIClient(
  apiKey = process.env.OPENAI_API_KEY,
): LlmClient {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey });
}
