import { Queue } from 'bullmq';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import IORedis from 'ioredis';
import { Pool } from 'pg';

export default fp(async (fastify: FastifyInstance) => {
  // Postgres
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'postgresql://postgres:postgres@postgres:5432/market_orders';
  const pool = new Pool({ connectionString });
  await pool.connect().then((c) => c.release());
  fastify.decorate('db', pool);

  // Redis clients (normal + subscriber)
  const redisConn = {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  const redis = new IORedis(redisConn);
  const redisSub = new IORedis(redisConn);

  fastify.decorate('redis', redis);
  fastify.decorate('redisSub', redisSub);

  // BullMQ queue (uses the same redis connection settings)
  const queue = new Queue('orders', { connection: redisConn });
  fastify.decorate('ordersQueue', queue);

  fastify.addHook('onClose', async () => {
    try {
      await queue.close();
    } catch (e) {
      console.error(e);
    }
    try {
      await redis.quit();
    } catch (e) {
      console.error(e);
    }
    try {
      await redisSub.quit();
    } catch (e) {
      console.error(e);
    }
    try {
      await pool.end();
    } catch (e) {
      console.error(e);
    }
  });
});

declare module 'fastify' {
  export interface FastifyInstance {
    db: Pool;
    redis: IORedis;
    redisSub: IORedis;
    ordersQueue: Queue;
  }
}
