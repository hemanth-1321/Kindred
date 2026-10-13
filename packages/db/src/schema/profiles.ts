import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.js";
import {
  assertionStatusEnum,
  assertionSubjectEnum,
  embeddingKindEnum,
  profileVersionStateEnum,
} from "./enums.js";
import { users } from "./users.js";

export const EMBEDDING_DIMENSIONS = 1536;

export const profileAssertions = pgTable(
  "profile_assertions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: assertionSubjectEnum("subject").notNull(),
    field: text("field").notNull(),
    value: jsonb("value").notNull(),
    evidenceMessageIds: uuid("evidence_message_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    status: assertionStatusEnum("status").notNull(),
    confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
    isHardConstraint: boolean("is_hard_constraint").notNull().default(false),
    importance: real("importance"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    sourceConversationVersion: integer("source_conversation_version").notNull(),
    supersededById: uuid("superseded_by_id").references(
      (): AnyPgColumn => profileAssertions.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("profile_assertions_current_idx")
      .on(t.userId, t.subject, t.field)
      .where(sql`${t.supersededAt} is null`),
  ],
);

export const profileVersions = pgTable(
  "profile_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    state: profileVersionStateEnum("state").notNull().default("processing"),
    profile: jsonb("profile").notNull(),
    shareableProjection: jsonb("shareable_projection"),
    sourceConversationVersion: integer("source_conversation_version").notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("profile_versions_user_version_uq").on(t.userId, t.version),
  ],
);

export const profileConstraints = pgTable(
  "profile_constraints",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    profileVersion: integer("profile_version").notNull(),
    birthDate: date("birth_date"),
    gender: text("gender"),
    seekingGenders: text("seeking_genders").array(),
    minPreferredAge: integer("min_preferred_age"),
    maxPreferredAge: integer("max_preferred_age"),
    city: text("city"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    maxDistanceKm: integer("max_distance_km"),
    openToRelocation: boolean("open_to_relocation"),
    relationshipIntent: text("relationship_intent"),
    childrenIntent: text("children_intent"),
    available: boolean("available").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("profile_constraints_available_idx")
      .on(t.city)
      .where(sql`${t.available}`),
  ],
);

export const profileEmbeddings = pgTable(
  "profile_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileVersion: integer("profile_version").notNull(),
    kind: embeddingKindEnum("kind").notNull(),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: vector("embedding", {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("profile_embeddings_version_uq").on(
      t.userId,
      t.profileVersion,
      t.kind,
      t.model,
    ),
    index("profile_embeddings_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const preferenceState = pgTable(
  "preference_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    version: integer("version").notNull(),
    value: jsonb("value").notNull(),
    strength: real("strength").notNull(),
    supportingFeedbackIds: uuid("supporting_feedback_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    policyVersion: text("policy_version").notNull(),
    confirmedByUser: boolean("confirmed_by_user").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("preference_state_field_version_uq").on(
      t.userId,
      t.field,
      t.version,
    ),
  ],
);
