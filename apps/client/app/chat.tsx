"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearConversationCache,
  errorMessage,
  getOrCreateConversation,
  listMessages,
  type Message,
  sendMessage,
} from "../lib/api";
import { authClient } from "../lib/auth-client";
import styles from "./page.module.css";

type ChatMessage = {
  key: string;
  role: "user" | "assistant";
  content: string;
  status: "sent" | "sending" | "failed";
};

function fromServer(message: Message): ChatMessage {
  return {
    key: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    status: "sent",
  };
}

// A user message with no reply after it means the reply failed earlier; offer a
// retry with its original key so the server can finish it without duplicating it.
function markUnanswered(messages: Message[]): ChatMessage[] {
  const chat = messages.filter((m) => m.role !== "system").map(fromServer);
  const last = messages.at(-1);
  if (last?.role === "user" && last.idempotencyKey) {
    chat[chat.length - 1] = {
      key: last.idempotencyKey,
      role: "user",
      content: last.content,
      status: "failed",
    };
  }
  return chat;
}

function upsert(messages: ChatMessage[], message: ChatMessage) {
  const index = messages.findIndex((m) => m.key === message.key);
  if (index === -1) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}

export function Chat({ userName }: { userName: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateConversation();
        const { messages } = await listMessages(id);
        if (cancelled) return;
        setConversationId(id);
        setMessages(markUnanswered(messages));
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const waiting = messages.some((m) => m.status === "sending");

  async function deliver(content: string, idempotencyKey: string) {
    if (!conversationId) return;
    const pending: ChatMessage = {
      key: idempotencyKey,
      role: "user",
      content,
      status: "sending",
    };
    setSendError(null);
    setMessages((prev) => upsert(prev, pending));
    try {
      const result = await sendMessage(conversationId, content, idempotencyKey);
      setMessages((prev) => [
        ...prev.filter((m) => m.key !== idempotencyKey),
        fromServer(result.userMessage),
        fromServer(result.assistantMessage),
      ]);
    } catch (error) {
      setMessages((prev) => upsert(prev, { ...pending, status: "failed" }));
      setSendError(errorMessage(error));
    }
  }

  function submit() {
    const content = draft.trim();
    if (!content || waiting || !conversationId) return;
    setDraft("");
    void deliver(content, crypto.randomUUID());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  async function signOut() {
    clearConversationCache();
    await authClient.signOut();
  }

  return (
    <main className={styles.chat}>
      <header className={styles.header}>
        <span className={styles.title}>Kindred</span>
        <span className={styles.muted}>
          {userName} ·{" "}
          <button type="button" className={styles.link} onClick={signOut}>
            Sign out
          </button>
        </span>
      </header>

      <section className={styles.messages} aria-live="polite">
        {loadError && <p className={styles.error}>{loadError}</p>}
        {!loadError && !conversationId && (
          <p className={styles.muted}>Loading your conversation…</p>
        )}
        {conversationId && messages.length === 0 && (
          <p className={styles.muted}>
            Say hello and tell me a little about yourself and the kind of
            relationship you&apos;re looking for.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.key}
            className={
              message.role === "user" ? styles.userBubble : styles.botBubble
            }
          >
            <p>{message.content}</p>
            {message.status === "failed" && (
              <button
                type="button"
                className={styles.retry}
                onClick={() => deliver(message.content, message.key)}
              >
                Not sent · Retry
              </button>
            )}
          </div>
        ))}
        {waiting && <p className={styles.muted}>Thinking…</p>}
        <div ref={endRef} />
      </section>

      {sendError && <p className={styles.error}>{sendError}</p>}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={2}
          maxLength={4000}
          disabled={!conversationId}
        />
        <button
          className={styles.primary}
          disabled={!draft.trim() || waiting || !conversationId}
        >
          Send
        </button>
      </form>
    </main>
  );
}
