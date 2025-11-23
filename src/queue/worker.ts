// src/queue/worker.ts
import { Worker, Queue, JobScheduler } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";
import { getBestQuote, mockExecuteSwap } from "../dex/mockDex";

// -------------------------------------------------------
// Redis connections
// -------------------------------------------------------
const redisConn = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: +(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

const redis = new IORedis(redisConn);
const redisPub = new IORedis(redisConn);

// -------------------------------------------------------
// Postgres pool
// -------------------------------------------------------
const dbPool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@postgres:5432/postgres"
});

// -------------------------------------------------------
// Queue + Scheduler
// -------------------------------------------------------
export const ordersQueue = new Queue("orders", { connection: redisConn });

// ensures delayed/retry jobs run correctly
new JobScheduler("orders", { connection: redisConn });

const concurrency = +(process.env.WORKER_CONCURRENCY || 5);

// -------------------------------------------------------
// Worker processor
// -------------------------------------------------------
const worker = new Worker(
  "orders",
  async (job) => {
    const { orderId, inputMint, outputMint, amount } = job.data;

    const publishStatus = async (status: string, extra: any = {}) => {
      // Update Redis snapshot for order
      await redis.hset(
        `order:${orderId}`,
        Object.fromEntries(
          Object.entries({ status, ...extra }).map(([k, v]) => [
            k,
            String(v)
          ])
        )
      );

      // Publish update to server
      await redisPub.publish(
        "order_updates",
        JSON.stringify({ orderId, status, ...extra })
      );
    };

    try {
      // routing
      await publishStatus("routing");
      const best = await getBestQuote(inputMint, outputMint, amount);

      await redis.hset(`order:${orderId}`, {
        venue: best.venue,
        price: String(best.price)
      });
      await publishStatus("routing", {
        venue: best.venue,
        price: best.price
      });

      // building
      await publishStatus("building");

      // submitted
      await publishStatus("submitted");

      // simulate execution
      const exec = await mockExecuteSwap(
        best.venue,
        inputMint,
        outputMint,
        amount
      );

      await publishStatus("confirmed", {
        txHash: exec.txHash,
        executionPrice: exec.executionPrice,
        venue: best.venue
      });

      // -------------------------------------------------------
      // Persist in DB (retry 5 times)
      // -------------------------------------------------------
      const persistToDb = async () => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            await dbPool.query(
              `UPDATE orders
              SET status=$1,
              tx_hash=$2,
              execution_price=$3
              WHERE id=$4`,
              ["confirmed", exec.txHash, exec.executionPrice, orderId]
            );
            return;
          } catch (err) {
            console.error(`DB insert failed (attempt ${attempt})`, err);
            await new Promise((r) => setTimeout(r, attempt * 500));
          }
        }

        // If DB completely fails, store fallback state
        await redis.hset(
          `order_persist_fail:${orderId}`,
          JSON.stringify({ inputMint, outputMint, amount, exec })
        );
      };

      persistToDb().catch(console.error);

      return { txHash: exec.txHash };
    } catch (err: any) {
      const msg = err?.message || String(err);

      await publishStatus("failed", { error: msg });

      // Save failure info
      await redis.hset(`order:${orderId}`, { status: "failed", error: msg });

      throw err;
    }
  },
  {
    concurrency,
    connection: redisConn
  }
);

worker.on("failed", (job, err) => {
  console.error(`Job failed: ${job?.id}`, err);
});

console.log("Worker started");
