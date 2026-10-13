CREATE TYPE "public"."account_state" AS ENUM('active', 'paused', 'deactivated', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."assertion_status" AS ENUM('explicit', 'inferred', 'contradicted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."assertion_subject" AS ENUM('self', 'desired_partner');--> statement-breakpoint
CREATE TYPE "public"."audio_turn_state" AS ENUM('uploaded', 'transcribing', 'draft_ready', 'committed', 'discarded', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."candidate_action" AS ENUM('introduce', 'ask', 'explore', 'wait');--> statement-breakpoint
CREATE TYPE "public"."embedding_kind" AS ENUM('self_description', 'desired_partner');--> statement-breakpoint
CREATE TYPE "public"."exposure_event_type" AS ENUM('selected', 'displayed', 'viewed');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('decline_reason', 'conversation_quality', 'continued_interest', 'unwanted_introduction', 'profile_correction');--> statement-breakpoint
CREATE TYPE "public"."input_mode" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TYPE "public"."introduction_decision" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."introduction_state" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."matching_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'stale');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'dispatched', 'dead');--> statement-breakpoint
CREATE TYPE "public"."profile_version_state" AS ENUM('processing', 'ready', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."reservation_state" AS ENUM('active', 'released');--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"sequence" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"revision_of_message_id" uuid,
	"input_mode" "input_mode" DEFAULT 'text' NOT NULL,
	"audio_turn_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"duration_ms" integer,
	"state" "audio_turn_state" DEFAULT 'uploaded' NOT NULL,
	"idempotency_key" text NOT NULL,
	"retention_deadline" timestamp with time zone NOT NULL,
	"raw_deleted_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audio_turn_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"draft_text" text NOT NULL,
	"accepted_text" text,
	"canonical_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"field" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"strength" real NOT NULL,
	"supporting_feedback_ids" uuid[] DEFAULT '{}' NOT NULL,
	"policy_version" text NOT NULL,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_assertions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" "assertion_subject" NOT NULL,
	"field" text NOT NULL,
	"value" jsonb NOT NULL,
	"evidence_message_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" "assertion_status" NOT NULL,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"is_hard_constraint" boolean DEFAULT false NOT NULL,
	"importance" real,
	"observed_at" timestamp with time zone NOT NULL,
	"source_conversation_version" integer NOT NULL,
	"superseded_by_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_constraints" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profile_version" integer NOT NULL,
	"birth_date" date,
	"gender" text,
	"seeking_genders" text[],
	"min_preferred_age" integer,
	"max_preferred_age" integer,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"max_distance_km" integer,
	"open_to_relocation" boolean,
	"relationship_intent" text,
	"children_intent" text,
	"available" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_version" integer NOT NULL,
	"kind" "embedding_kind" NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"state" "profile_version_state" DEFAULT 'processing' NOT NULL,
	"profile" jsonb NOT NULL,
	"shareable_projection" jsonb,
	"source_conversation_version" integer NOT NULL,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"candidate_profile_version" integer NOT NULL,
	"score_user_to_candidate" real,
	"score_candidate_to_user" real,
	"coverage_user_to_candidate" real,
	"coverage_candidate_to_user" real,
	"pair_score" real,
	"features" jsonb NOT NULL,
	"unknowns" jsonb NOT NULL,
	"llm_assessment" jsonb,
	"action" "candidate_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exposure_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"introduction_id" uuid,
	"event_type" "exposure_event_type" NOT NULL,
	"position" integer,
	"policy_version" text NOT NULL,
	"selection_probability" real,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"introduction_id" uuid,
	"kind" "feedback_kind" NOT NULL,
	"reason" text,
	"outcome" text,
	"payload" jsonb,
	"attribution" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "introduction_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"introduction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "reservation_state" DEFAULT 'active' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "introductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"state" "introduction_state" DEFAULT 'pending' NOT NULL,
	"user_a_decision" "introduction_decision" DEFAULT 'pending' NOT NULL,
	"user_b_decision" "introduction_decision" DEFAULT 'pending' NOT NULL,
	"user_a_decided_at" timestamp with time zone,
	"user_b_decided_at" timestamp with time zone,
	"source_run_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "introductions_canonical_pair" CHECK ("introductions"."user_a_id" < "introductions"."user_b_id")
);
--> statement-breakpoint
CREATE TABLE "matching_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_version" integer NOT NULL,
	"policy_version" text NOT NULL,
	"prompt_version" text,
	"status" "matching_run_status" DEFAULT 'queued' NOT NULL,
	"candidate_count" integer,
	"timings" jsonb,
	"usage" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"job_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_request_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"audio_seconds" numeric(10, 2),
	"latency_ms" integer,
	"estimated_cost_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_state" SET DEFAULT 'active'::"public"."account_state";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "account_state" SET DATA TYPE "public"."account_state" USING "account_state"::"public"."account_state";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "max_active_introductions" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_audio_turn_id_audio_turns_id_fk" FOREIGN KEY ("audio_turn_id") REFERENCES "public"."audio_turns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_revision_of_fk" FOREIGN KEY ("revision_of_message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_turns" ADD CONSTRAINT "audio_turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_turns" ADD CONSTRAINT "audio_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_audio_turn_id_audio_turns_id_fk" FOREIGN KEY ("audio_turn_id") REFERENCES "public"."audio_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_revisions" ADD CONSTRAINT "transcript_revisions_canonical_message_fk" FOREIGN KEY ("canonical_message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_state" ADD CONSTRAINT "preference_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_assertions" ADD CONSTRAINT "profile_assertions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_assertions" ADD CONSTRAINT "profile_assertions_superseded_by_id_profile_assertions_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."profile_assertions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_constraints" ADD CONSTRAINT "profile_constraints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_embeddings" ADD CONSTRAINT "profile_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evaluations" ADD CONSTRAINT "candidate_evaluations_run_id_matching_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."matching_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evaluations" ADD CONSTRAINT "candidate_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_evaluations" ADD CONSTRAINT "candidate_evaluations_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposure_events" ADD CONSTRAINT "exposure_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposure_events" ADD CONSTRAINT "exposure_events_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exposure_events" ADD CONSTRAINT "exposure_events_introduction_id_introductions_id_fk" FOREIGN KEY ("introduction_id") REFERENCES "public"."introductions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_introduction_id_introductions_id_fk" FOREIGN KEY ("introduction_id") REFERENCES "public"."introductions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introduction_reservations" ADD CONSTRAINT "introduction_reservations_introduction_id_introductions_id_fk" FOREIGN KEY ("introduction_id") REFERENCES "public"."introductions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introduction_reservations" ADD CONSTRAINT "introduction_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_source_run_id_matching_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."matching_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_runs" ADD CONSTRAINT "matching_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_sequence_uq" ON "conversation_messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_idempotency_uq" ON "conversation_messages" USING btree ("conversation_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_audio_turn_uq" ON "conversation_messages" USING btree ("audio_turn_id") WHERE "conversation_messages"."revision_of_message_id" is null;--> statement-breakpoint
CREATE INDEX "conversation_messages_user_idx" ON "conversation_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audio_turns_idempotency_uq" ON "audio_turns" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "audio_turns_conversation_idx" ON "audio_turns" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "audio_turns_retention_idx" ON "audio_turns" USING btree ("retention_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_revisions_turn_revision_uq" ON "transcript_revisions" USING btree ("audio_turn_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_state_field_version_uq" ON "preference_state" USING btree ("user_id","field","version");--> statement-breakpoint
CREATE INDEX "profile_assertions_current_idx" ON "profile_assertions" USING btree ("user_id","subject","field") WHERE "profile_assertions"."superseded_at" is null;--> statement-breakpoint
CREATE INDEX "profile_constraints_available_idx" ON "profile_constraints" USING btree ("city") WHERE "profile_constraints"."available";--> statement-breakpoint
CREATE UNIQUE INDEX "profile_embeddings_version_uq" ON "profile_embeddings" USING btree ("user_id","profile_version","kind","model");--> statement-breakpoint
CREATE INDEX "profile_embeddings_hnsw_idx" ON "profile_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_versions_user_version_uq" ON "profile_versions" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_evaluations_run_candidate_uq" ON "candidate_evaluations" USING btree ("run_id","candidate_id");--> statement-breakpoint
CREATE INDEX "exposure_events_user_idx" ON "exposure_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "feedback_events_user_idx" ON "feedback_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "introduction_reservations_intro_user_uq" ON "introduction_reservations" USING btree ("introduction_id","user_id");--> statement-breakpoint
CREATE INDEX "introduction_reservations_active_idx" ON "introduction_reservations" USING btree ("user_id") WHERE "introduction_reservations"."state" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "introductions_active_pair_uq" ON "introductions" USING btree ("user_a_id","user_b_id") WHERE "introductions"."state" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "introductions_user_b_idx" ON "introductions" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "matching_runs_user_idx" ON "matching_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "usage_events_created_idx" ON "usage_events" USING btree ("created_at");