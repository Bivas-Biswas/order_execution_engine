import { buildFastify } from "./config/fastify";
import { registerOrderRoutes } from "./modules/orders/orders.routes";
import { registerOrderWS } from "./modules/orders/orders.ws";
import { registerOrderSubscriber } from "./modules/orders/orders.subscriber";

export async function createApp() {
  const fastify = buildFastify();

  await registerOrderRoutes(fastify);

  const wsClients = registerOrderWS(fastify);
  registerOrderSubscriber(fastify, wsClients);

  fastify.get("/api/test", async () => ({ msg: "Server working!" }));

  return fastify;
}
