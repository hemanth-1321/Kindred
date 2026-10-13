export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sequence: number;
  idempotencyKey: string | null;
  createdAt: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error ?? `Request failed with status ${response.status}`,
    );
  }
  return body as T;
}

let conversationRequest: Promise<string> | null = null;

// React runs effects twice in development; share one request so a new user
// doesn't end up with two empty conversations.
export function getOrCreateConversation(): Promise<string> {
  conversationRequest ??= (async () => {
    const { conversations } = await apiFetch<{
      conversations: { id: string }[];
    }>("/conversations");
    if (conversations[0]) return conversations[0].id;
    const { conversation } = await apiFetch<{ conversation: { id: string } }>(
      "/conversations",
      { method: "POST" },
    );
    return conversation.id;
  })().catch((error) => {
    conversationRequest = null;
    throw error;
  });
  return conversationRequest;
}

export function clearConversationCache() {
  conversationRequest = null;
}

export type SentMessage = { userMessage: Message; assistantMessage: Message };

export async function sendMessage(
  conversationId: string,
  content: string,
  idempotencyKey: string,
  onDelta: (text: string) => void,
): Promise<SentMessage> {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ content, idempotencyKey }),
    },
  );
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.error ?? `Request failed with status ${response.status}`,
    );
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const event = parseEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event.name === "delta") onDelta(event.data.text);
      if (event.name === "done") return event.data;
      if (event.name === "error") throw new ApiError(502, event.data.error);
    }
  }
  throw new ApiError(502, "The connection closed before the reply finished");
}

function parseEvent(block: string) {
  let name = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) name = line.slice(7);
    else if (line.startsWith("data: ")) data += line.slice(6);
  }
  return { name, data: JSON.parse(data) };
}

export function listMessages(conversationId: string) {
  return apiFetch<{ messages: Message[] }>(
    `/conversations/${conversationId}/messages`,
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
