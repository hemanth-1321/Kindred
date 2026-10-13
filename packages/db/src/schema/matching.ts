import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./columns.js";
import {
  candidateActionEnum,
  exposureEventTypeEnum,
  feedbackKindEnum,
  introductionDecisionEnum,
  introductionStateEnum,
  matchingRunStatusEnum,
  reservationStateEnum,
} from "./enums.js";
import { users } from "./users.js";

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
);

export const matchingRuns = pgTable(
  "matching_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileVersion: integer("profile_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    promptVersion: text("prompt_version"),
    status: matchingRunStatusEnum("status").notNull().default("queued"),
    candidateCount: integer("candidate_count"),
    timings: jsonb("timings"),
    usage: jsonb("usage"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("matching_runs_user_idx").on(t.userId, t.createdAt)],
);

export const candidateEvaluations = pgTable(
  "candidate_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => matchingRuns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateProfileVersion: integer("candidate_profile_version").notNull(),
    scoreUserToCandidate: real("score_user_to_candidate"),
    scoreCandidateToUser: real("score_candidate_to_user"),
    coverageUserToCandidate: real("coverage_user_to_candidate"),
    coverageCandidateToUser: real("coverage_candidate_to_user"),
    pairScore: real("pair_score"),
    features: jsonb("features").notNull(),
    unknowns: jsonb("unknowns").notNull(),
    llmAssessment: jsonb("llm_assessment"),
    action: candidateActionEnum("action").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("candidate_evaluations_run_candidate_uq").on(
      t.runId,
      t.candidateId,
    ),
  ],
);

export const introductions = pgTable(
  "introductions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: introductionStateEnum("state").notNull().default("pending"),
    userADecision: introductionDecisionEnum("user_a_decision")
      .notNull()
      .default("pending"),
    userBDecision: introductionDecisionEnum("user_b_decision")
      .notNull()
      .default("pending"),
    userADecidedAt: timestamp("user_a_decided_at", { withTimezone: true }),
    userBDecidedAt: timestamp("user_b_decided_at", { withTimezone: true }),
    sourceRunId: uuid("source_run_id").references(() => matchingRuns.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("introductions_canonical_pair", sql`${t.userAId} < ${t.userBId}`),
    uniqueIndex("introductions_active_pair_uq")
      .on(t.userAId, t.userBId)
      .where(sql`${t.state} in ('pending', 'accepted')`),
    index("introductions_user_b_idx").on(t.userBId),
  ],
);

export const introductionReservations = pgTable(
  "introduction_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    introductionId: uuid("introduction_id")
      .notNull()
      .references(() => introductions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: reservationStateEnum("state").notNull().default("active"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("introduction_reservations_intro_user_uq").on(
      t.introductionId,
      t.userId,
    ),
    index("introduction_reservations_active_idx")
      .on(t.userId)
      .where(sql`${t.state} = 'active'`),
  ],
);

export const exposureEvents = pgTable(
  "exposure_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    introductionId: uuid("introduction_id").references(() => introductions.id, {
      onDelete: "cascade",
    }),
    eventType: exposureEventTypeEnum("event_type").notNull(),
    position: integer("position"),
    policyVersion: text("policy_version").notNull(),
    selectionProbability: real("selection_probability"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("exposure_events_user_idx").on(t.userId, t.occurredAt)],
);

export const feedbackEvents = pgTable(
  "feedback_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    introductionId: uuid("introduction_id").references(() => introductions.id, {
      onDelete: "cascade",
    }),
    kind: feedbackKindEnum("kind").notNull(),
    reason: text("reason"),
    outcome: text("outcome"),
    payload: jsonb("payload"),
    attribution: jsonb("attribution"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feedback_events_user_idx").on(t.userId, t.occurredAt)],
);
