function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: required("BETTER_AUTH_URL"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  openaiApiKey: process.env.OPENAI_API_KEY || undefined,
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-6-luna",
};
