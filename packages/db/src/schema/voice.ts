import {
  type AnyPgColumn,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.js";
import { conversationMessages, conversations } from "./conversations.js";
import { audioTurnStateEnum } from "./enums.js";
import { users } from "./users.js";

export const audioTurns = pgTable(
  "audio_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references((): AnyPgColumn => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    objectKey: text("object_key"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    state: audioTurnStateEnum("state").notNull().default("uploaded"),
    idempotencyKey: text("idempotency_key").notNull(),
    retentionDeadline: timestamp("retention_deadline", {
      withTimezone: true,
    }).notNull(),
    rawDeletedAt: timestamp("raw_deleted_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("audio_turns_idempotency_uq").on(t.userId, t.idempotencyKey),
    index("audio_turns_conversation_idx").on(t.conversationId),
    index("audio_turns_retention_idx").on(t.retentionDeadline),
  ],
);

export const transcriptRevisions = pgTable(
  "transcript_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    audioTurnId: uuid("audio_turn_id")
      .notNull()
      .references(() => audioTurns.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    draftText: text("draft_text").notNull(),
    acceptedText: text("accepted_text"),
    canonicalMessageId: uuid("canonical_message_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "transcript_revisions_canonical_message_fk",
      columns: [t.canonicalMessageId],
      foreignColumns: [conversationMessages.id],
    }).onDelete("set null"),
    uniqueIndex("transcript_revisions_turn_revision_uq").on(
      t.audioTurnId,
      t.revision,
    ),
  ],
);
