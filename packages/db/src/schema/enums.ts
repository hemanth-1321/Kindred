import { pgEnum } from "drizzle-orm/pg-core";

export const accountStateEnum = pgEnum("account_state", [
  "active",
  "paused",
  "deactivated",
  "deleted",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

export const inputModeEnum = pgEnum("input_mode", ["text", "voice"]);

export const audioTurnStateEnum = pgEnum("audio_turn_state", [
  "uploaded",
  "transcribing",
  "draft_ready",
  "committed",
  "discarded",
  "expired",
  "failed",
]);

export const assertionSubjectEnum = pgEnum("assertion_subject", [
  "self",
  "desired_partner",
]);

export const assertionStatusEnum = pgEnum("assertion_status", [
  "explicit",
  "inferred",
  "contradicted",
  "unknown",
]);

export const profileVersionStateEnum = pgEnum("profile_version_state", [
  "processing",
  "ready",
  "superseded",
]);

export const embeddingKindEnum = pgEnum("embedding_kind", [
  "self_description",
  "desired_partner",
]);

export const matchingRunStatusEnum = pgEnum("matching_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "stale",
]);

export const candidateActionEnum = pgEnum("candidate_action", [
  "introduce",
  "ask",
  "explore",
  "wait",
]);

export const introductionStateEnum = pgEnum("introduction_state", [
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
]);

export const introductionDecisionEnum = pgEnum("introduction_decision", [
  "pending",
  "accepted",
  "declined",
]);

export const reservationStateEnum = pgEnum("reservation_state", [
  "active",
  "released",
]);

export const exposureEventTypeEnum = pgEnum("exposure_event_type", [
  "selected",
  "displayed",
  "viewed",
]);

export const feedbackKindEnum = pgEnum("feedback_kind", [
  "decline_reason",
  "conversation_quality",
  "continued_interest",
  "unwanted_introduction",
  "profile_correction",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "dispatched",
  "dead",
]);
