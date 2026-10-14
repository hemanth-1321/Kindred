import { PROFILE_EXTRACT_TOPIC, type ProfileExtractPayload } from "@repo/db";
import { Worker } from "bullmq";
import { startOutboxDispatcher } from "./dispatcher.js";
import { env } from "./env.js";
import { runProfileExtraction } from "./profile/job.js";
import {
  createProfileQueue,
  createRedisConnection,
  PROFILE_QUEUE,
} from "./queue.js";

const queueConnection = createRedisConnection();
const workerConnection = createRedisConnection();

const profileQueue = createProfileQueue(queueConnection);
const stopDispatcher = startOutboxDispatcher(profileQueue);

const profileWorker = new Worker(
  PROFILE_QUEUE,
  async (job) => {
    if (job.name !== PROFILE_EXTRACT_TOPIC) {
      throw new Error(`Unknown job ${job.name}`);
    }
    return runProfileExtraction(job.data as ProfileExtractPayload);
  },
  { connection: workerConnection, concurrency: env.extractionConcurrency },
);

profileWorker.on("completed", (job, result) => {
  console.log(`${job.name} ${job.id}: ${result}`);
});
profileWorker.on("failed", (job, error) => {
  console.error(
    `${job?.name} ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    error.message,
  );
});

console.log(
  `Worker started: outbox dispatcher and ${PROFILE_QUEUE} queue (concurrency ${env.extractionConcurrency})`,
);

async function shutdown() {
  stopDispatcher();
  await profileWorker.close();
  await profileQueue.close();
  queueConnection.disconnect();
  workerConnection.disconnect();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
