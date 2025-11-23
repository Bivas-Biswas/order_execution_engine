import { FastifyInstance, FastifyRequest } from "fastify";
import { redis } from "../../config/redis";
import { Type, Static } from "@sinclair/typebox";

const wsClients = new Map<string, Set<any>>();

export function registerOrderWS(fastify: FastifyInstance) {

  // need wrap around registor scope
  fastify.register(async function (fastify) {
    const WsQuerySchema = Type.Object({ orderId: Type.String() });
    type WsQuery = Static<typeof WsQuerySchema>;

    fastify.get<{ Querystring: WsQuery }>("/api/orders/ws", {
      websocket: true,
      schema: { querystring: WsQuerySchema }
    }, (connection, req: FastifyRequest<{ Querystring: WsQuery }>) => {

      if (!req.query) return connection.close();

      const { orderId } = req.query;

      if (!orderId) {
        connection.send(JSON.stringify({ error: "Missing orderId" }));
        connection.close();
        return;
      }

      // check already exist wsclients for this orderid
      // new client for same orderid possible -> when same client multiple tab open
      if (!wsClients.has(orderId)) wsClients.set(orderId, new Set());
      wsClients.get(orderId)!.add(connection);

      // getting the order from redis
      (async () => {
        const snapshot = await redis.hgetall(`order:${orderId}`);
        if (Object.keys(snapshot).length)
          connection.send(JSON.stringify({ type: "snapshot", data: snapshot }));
        else
          connection.send(JSON.stringify({ status: "pending", orderId }));
      })();

      // addint the close event
      connection.on("close", () => {
        const set = wsClients.get(orderId);
        if (!set) return;
        set.delete(connection);
        if (set.size === 0) wsClients.delete(orderId);
      });
    });

  });

  return wsClients;
}
