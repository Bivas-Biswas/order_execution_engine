import { WebSocket } from '@fastify/websocket';
import { Static, Type } from '@sinclair/typebox';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { redis } from '../../config/redis';
import { OrdersController } from './orders.controller';

const wsClients = new Map<string, Set<WebSocket>>();

export function registerOrderWS(fastify: FastifyInstance) {
  // need wrap around registor scope
  fastify.register(async function (fastify) {
    const WsQuerySchema = Type.Object({ orderId: Type.String() });
    type WsQuery = Static<typeof WsQuerySchema>;

    fastify.get<{ Querystring: WsQuery }>(
      '/api/orders/ws',
      {
        websocket: true,
        schema: { querystring: WsQuerySchema },
      },
      async (connection, req: FastifyRequest<{ Querystring: WsQuery }>) => {
        if (!req.query) return connection.close();

        const { orderId } = req.query;

        if (!orderId) {
          connection.send(JSON.stringify({ error: 'Missing orderId' }));
          connection.close();
          return;
        }

        // check already exist wsclients for this orderid
        // orderId exist or not
        // new client for same orderid possible -> when same client multiple tab open
        if (!wsClients.has(orderId)) {
          // Check Redis existence (fast check)
          const exists = await redis.exists(orderId);

          // If not in Redis, fall back to PostgreSQL
          if (!exists) {
            const row = await OrdersController.getOne(orderId);

            // order not exisit
            if (!row) {
              connection.send(JSON.stringify({ error: 'Order not found' }));
              connection.close();
              return;
            }

            // it may possilbe it is a old order try to
            // connect through ws
            if (row.status === 'failed' || row.status === 'confirmed') {
              connection.send(JSON.stringify({ error: 'Order already processed' }));
              connection.close();
              return;
            }
          }
          wsClients.set(orderId, new Set());
        }

        // add the connection to the corresponding orderId
        wsClients.get(orderId)!.add(connection);

        // getting the order from redis
        (async () => {
          const snapshot = await redis.hgetall(`order:${orderId}`);
          if (Object.keys(snapshot).length)
            connection.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
          else connection.send(JSON.stringify({ status: 'pending', orderId }));
        })();

        // addint the close event
        connection.on('close', () => {
          const set = wsClients.get(orderId);
          if (!set) return;
          set.delete(connection);
          if (set.size === 0) wsClients.delete(orderId);
        });
      },
    );
  });

  return wsClients;
}
