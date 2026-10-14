function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  openaiApiKey: process.env.OPENAI_API_KEY || undefined,
  extractionModel:
    process.env.OPENAI_EXTRACTION_MODEL ||
    process.env.OPENAI_CHAT_MODEL ||
    "gpt-6-luna",
  extractionConcurrency: Number(process.env.EXTRACTION_CONCURRENCY ?? 4),
};
