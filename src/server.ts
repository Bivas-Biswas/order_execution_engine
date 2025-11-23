import { env } from "./config/env";
import { initDb } from "./db";
import { createApp } from "./app";

(async () => {
  await initDb();
  const fastify = await createApp();
  await fastify.listen({ port: env.port, host: "0.0.0.0" });
})();
