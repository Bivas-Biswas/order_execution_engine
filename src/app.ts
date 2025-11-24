import { buildFastify } from './config/fastify';
import { registerOrderRoutes } from './modules/orders/orders.routes';
import { registerOrderSubscriber } from './modules/orders/orders.subscriber';
import { registerOrderWS } from './modules/orders/orders.ws';

export async function createApp() {
  const fastify = buildFastify();

  await registerOrderRoutes(fastify);

  const wsClients = registerOrderWS(fastify);
  registerOrderSubscriber(fastify, wsClients);

  fastify.get('/api/test', async () => ({ msg: 'Server working!' }));

  return fastify;
}
