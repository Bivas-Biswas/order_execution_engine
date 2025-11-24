import { JobScheduler, Worker } from 'bullmq';

import { getBestQuote, mockCreateTransaction, mockExecuteSwap } from '../../dex/mockDex';
import { dbPool, redis, redisConn, redisPub } from './redis.order.worker';

new JobScheduler('orders', { connection: redisConn });

const concurrency = +(process.env.WORKER_CONCURRENCY || 5);

const publishStatus = async (orderId: string, status: string, extra: object = {}) => {
  // Update Redis snapshot for order
  await redis.hset(
    `order:${orderId}`,
    Object.fromEntries(Object.entries({ status, ...extra }).map(([k, v]) => [k, String(v)])),
  );

  // Publish update to server
  await redisPub.publish('order_updates', JSON.stringify({ orderId, status, ...extra }));
};

const loggerDex = (type: 'INFO' | 'ERROR', orderId: string, msg: string) => {
  if (type === 'INFO') {
    console.log(`[${type}][DEX:${orderId}] ${msg}`);
  } else {
    console.error(`[${type}][DEX:${type}:${orderId}] ${msg}`);
  }
};

const worker = new Worker(
  'orders',
  async (job) => {
    const { orderId, inputMint, outputMint, amount, slippage_pct } = job.data;

    try {
      // ROUTING
      await publishStatus(orderId, 'routing');
      loggerDex('INFO', orderId, 'Routing started');

      const best = await getBestQuote(inputMint, outputMint, amount);

      loggerDex(
        'INFO',
        orderId,
        `BestQuote selected: ${best.venue} price=${best.price} expectedOut=${best.expectedOut}`,
      );

      // BUILDING
      await publishStatus(orderId, 'building');
      loggerDex('INFO', orderId, `Creating transaction for ${best.venue}`);

      await mockCreateTransaction();

      // SUBMITTING
      loggerDex('INFO', orderId, 'Submitting transaction');
      await publishStatus(orderId, 'submitted');

      // EXECUTION (RETRY + SLOW MARKET + SLIPPAGE PROTECTION)
      const handleMockExecute = async () => {
        let lastError: string | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          const exec = await mockExecuteSwap({
            venue: best.venue,
            input: inputMint,
            output: outputMint,
            amount,
            expectedOut: best.expectedOut,
            slippagePct: slippage_pct,
          });

          // SUCCESS
          if (!exec.error) {
            return exec;
          }

          // FAILURE
          lastError = exec.error;
          loggerDex(
            'ERROR',
            orderId,
            `Execution failed: ${exec.error}. Retrying attempt ${attempt}/3...`,
          );

          await new Promise((r) => setTimeout(r, attempt * 500)); // exponential backoff
        }

        return { error: lastError ?? 'Unknown execution failure' };
      };

      const exec = await handleMockExecute();

      // IF EXECUTION FAILED -> GO TO FAILURE HANDLER
      if (exec.error) {
        throw new Error(exec.error);
      }

      // EXECUTION SUCCESS
      await dbPool.query(
        `UPDATE orders
     SET status=$1,
         tx_hash=$2,
         execution_price=$3,
         updated_at = now()
     WHERE id=$4`,
        ['confirmed', exec.txHash, exec.executionPrice, orderId],
      );

      loggerDex('INFO', orderId, 'Transaction confirmed');

      await publishStatus(orderId, 'confirmed', {
        txHash: exec.txHash,
        executionPrice: exec.executionPrice,
        venue: best.venue,
      });

      return { txHash: exec.txHash };
    } catch (err: Error) {
      // ANY FAILURE FALLS HERE
      const msg = err?.message || String(err);
      loggerDex('ERROR', orderId, msg);

      await dbPool.query(
        `UPDATE orders
     SET status=$1,
         error=$2,
         updated_at = now()
     WHERE id=$3`,
        ['failed', msg, orderId],
      );

      await publishStatus(orderId, 'failed', { error: msg });

      throw err; // tell BullMQ job failed
    } finally {
      // ALWAYS CLEAN REDIS
      await redis.del(orderId);
    }
  },
  {
    concurrency,
    connection: redisConn,
  },
);

worker.on('failed', (job, err) => {
  console.error(`Job failed: ${job?.id}`, err);
});

console.log('Worker started');
