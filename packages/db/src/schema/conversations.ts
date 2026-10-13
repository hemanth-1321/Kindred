import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.js";
import { inputModeEnum, messageRoleEnum } from "./enums.js";
import { users } from "./users.js";
import { audioTurns } from "./voice.js";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("conversations_user_idx").on(t.userId)],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    sequence: integer("sequence").notNull(),
    revision: integer("revision").notNull().default(1),
    revisionOfMessageId: uuid("revision_of_message_id"),
    inputMode: inputModeEnum("input_mode").notNull().default("text"),
    audioTurnId: uuid("audio_turn_id").references(() => audioTurns.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "conversation_messages_revision_of_fk",
      columns: [t.revisionOfMessageId],
      foreignColumns: [t.id],
    }).onDelete("cascade"),
    uniqueIndex("conversation_messages_sequence_uq").on(
      t.conversationId,
      t.sequence,
    ),
    uniqueIndex("conversation_messages_idempotency_uq").on(
      t.conversationId,
      t.idempotencyKey,
    ),
    uniqueIndex("conversation_messages_audio_turn_uq")
      .on(t.audioTurnId)
      .where(sql`${t.revisionOfMessageId} is null`),
    index("conversation_messages_user_idx").on(t.userId),
  ],
);
