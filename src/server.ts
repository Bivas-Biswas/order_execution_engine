import { createApp } from './app';
import { env } from './config/env';
import { initDb } from './db';

(async () => {
  await initDb();
  const fastify = await createApp();
  await fastify.listen({ port: env.port, host: '0.0.0.0' });
})();
