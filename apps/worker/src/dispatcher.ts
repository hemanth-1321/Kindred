import { outbox } from "@repo/db";
import type { Queue } from "bullmq";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "./db.js";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 1_000;
const MAX_ATTEMPTS = 10;

/** Moves due outbox rows onto BullMQ. Delivery is at-least-once; the job ID dedupes redelivery. */
export function startOutboxDispatcher(queue: Queue) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = async () => {
    try {
      while (!stopped && (await dispatchBatch(queue)) === BATCH_SIZE) {
        // Keep draining while full batches remain.
      }
    } catch (error) {
      console.error("outbox dispatch failed", error);
    }
    if (!stopped) timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  void tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

async function dispatchBatch(queue: Queue): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outbox)
      .where(
        and(eq(outbox.status, "pending"), lte(outbox.availableAt, new Date())),
      )
      .orderBy(asc(outbox.availableAt))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });

    for (const row of rows) {
      const attempts = row.attempts + 1;
      try {
        await queue.add(row.topic, row.payload, { jobId: row.id });
        await tx
          .update(outbox)
          .set({ status: "dispatched", attempts, dispatchedAt: new Date() })
          .where(eq(outbox.id, row.id));
      } catch (error) {
        const retryInMs = Math.min(60_000, 1_000 * 2 ** attempts);
        await tx
          .update(outbox)
          .set({
            status: attempts >= MAX_ATTEMPTS ? "dead" : "pending",
            attempts,
            availableAt: new Date(Date.now() + retryInMs),
            lastError: error instanceof Error ? error.message : String(error),
          })
          .where(eq(outbox.id, row.id));
      }
    }
    return rows.length;
  });
}
