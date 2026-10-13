import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt } from "./columns.js";
import { outboxStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topic: text("topic").notNull(),
    jobKey: text("job_key").notNull().unique(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_pending_idx").on(t.status, t.availableAt)],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    providerRequestId: text("provider_request_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    audioSeconds: numeric("audio_seconds", { precision: 10, scale: 2 }),
    latencyMs: integer("latency_ms"),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 6,
    }),
    createdAt: createdAt(),
  },
  (t) => [index("usage_events_created_idx").on(t.createdAt)],
);
