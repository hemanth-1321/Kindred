import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const PROFILE_QUEUE = "profile";

// BullMQ workers block on Redis, which requires unlimited retries per request.
export function createRedisConnection() {
  return new Redis(env.redisUrl, { maxRetriesPerRequest: null });
}

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000, jitter: 0.5 },
  // Completed jobs stay long enough for the job ID to dedupe redelivered outbox rows;
  // failed jobs stay for a week as the dead-letter record.
  removeOnComplete: { age: 24 * 60 * 60 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

export function createProfileQueue(connection: Redis) {
  return new Queue(PROFILE_QUEUE, { connection, defaultJobOptions });
}
