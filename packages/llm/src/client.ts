import OpenAI from "openai";

export function createOpenAIClient(apiKey = process.env.OPENAI_API_KEY) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return new OpenAI({ apiKey });
}
