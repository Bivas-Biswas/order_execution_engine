import { Worker, JobScheduler } from "bullmq";
import { getBestQuote, mockExecuteSwap, mockCreateTransaction } from "../../dex/mockDex";
import { dbPool, redis, redisPub, redisConn } from './redis.order.worker'

new JobScheduler("orders", { connection: redisConn });

const concurrency = +(process.env.WORKER_CONCURRENCY || 5);

const publishStatus = async (orderId: string, status: string, extra: any = {}) => {

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

const loggerDex = (type: 'INFO' | 'ERROR', orderId: string, msg: string) => {
  if(type === 'INFO'){
    console.log(`[${type}][DEX:${orderId}] ${msg}`);
  } else {
    console.error(`[${type}][DEX:${type}:${orderId}] ${msg}`);
  }
}

const worker = new Worker(
  "orders",
  async (job) => {
    const { orderId, inputMint, outputMint, amount } = job.data;

    try {
      // routing
      await publishStatus(orderId, "routing");
      loggerDex("INFO", orderId, 'Routing started')
      const best = await getBestQuote(inputMint, outputMint, amount);

      loggerDex("INFO", orderId, 'BestQuote selected: ' + best);

      // building
      await publishStatus(orderId, "building");

      loggerDex("INFO", orderId, 'Creating transaction: ' + best);
      // create transaction
      await mockCreateTransaction();

      loggerDex("INFO", orderId, 'Submitting transaction: ' + best);
      // submitted
      await publishStatus(orderId, "submitted");

      // simulate execution
      // if faild retry 3 times
      const handleMockExecute = async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const exec = await mockExecuteSwap(
              best.venue,
              inputMint,
              outputMint,
              amount
            );
            return exec; // success
          } catch (err) {
            loggerDex("ERROR", orderId, "Exchnage server issue. Retring... " + attempt);
            // exponential backoff delay
            await new Promise((r) => setTimeout(r, attempt * 500));
          }
        }

        // All attempts failed throw
        throw new Error("Transaction execution failed!");
      };

      const exec = await handleMockExecute();

      // save to db
      await dbPool.query(
        `UPDATE orders
         SET status=$1,
             tx_hash=$2,
             execution_price=$3,
             updated_at = now()
         WHERE id=$4`,
        ["confirmed", exec.txHash, exec.executionPrice, orderId]
      );

      loggerDex("INFO", orderId, "Transaction confirmed.");

      await publishStatus(orderId, "confirmed", {
        txHash: exec.txHash,
        executionPrice: exec.executionPrice,
        venue: best.venue
      });

      return { txHash: exec.txHash };
    } catch (err: any) {
      const msg = err?.message || String(err);
      loggerDex("ERROR", orderId, msg);

      // update database with failure
      await dbPool.query(
        `UPDATE orders
         SET status=$1,
             error=$2,
             updated_at = now()
         WHERE id=$3`,
        ["failed", msg, orderId]
      );

      await publishStatus(orderId, "failed", { error: msg });

      throw err; // ensures BullMQ marks job as failed
    } finally {

      // remove the orderId from redis
      await redis.del(orderId);
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
