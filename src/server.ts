import Fastify, { FastifyRequest } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { randomUUID } from "crypto";
import { pool, initDb } from "./db";
import { Queue } from "bullmq";
import { OrderRequest } from "./types";
import { Static, TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import IORedis from "ioredis";

// -------------------------------------------------------
// Redis clients
// -------------------------------------------------------
const redisConn = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: +(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

const redis = new IORedis(redisConn);

const redisSub = new IORedis(redisConn);

// -------------------------------------------------------
// OrdersQueue
// -------------------------------------------------------
const ordersQueue = new Queue("orders", { connection: redisConn });

// -------------------------------------------------------
// Fastify
// -------------------------------------------------------
const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
fastify.register(fastifyWebsocket);

// -------------------------------------------------------
// WS subscription map: orderId → Set<WebSocket connections>
// -------------------------------------------------------
const wsClients = new Map<string, Set<any>>();

// -------------------------------------------------------
// Redis SUBSCRIBE to worker messages
// -------------------------------------------------------
redisSub.on("message", (channel, message) => {
  if (channel !== "order_updates") return;

  try {
    const payload = JSON.parse(message);
    const orderId = payload.orderId;
    if (!orderId) return;

    const clients = wsClients.get(orderId);
    if (!clients) return;

    for (const conn of clients) {
      try {
        conn.send(JSON.stringify(payload));
        if (payload.status === "confirmed") {
          conn.close();
        }
      } catch (err) {
        fastify.log.warn({ err }, "WS send failed");
      }
    }
  } catch (err) {
    fastify.log.error(err, "Invalid JSON from worker");
  }
});

// -------------------------------------------------------
// POST /api/orders/execute
// -------------------------------------------------------
fastify.post("/api/orders/execute", async (req, reply) => {
  const body = req.body as OrderRequest;

  if (!body.inputMint || !body.outputMint || typeof body.amount !== "number") {
    return reply.status(400).send({ error: "Invalid order request" });
  }

  const orderId = randomUUID();

  await pool.query(
    "INSERT INTO orders (id, input_mint, output_mint, amount, status) VALUES ($1,$2,$3,$4,$5)",
    [orderId, body.inputMint, body.outputMint, body.amount, "pending"]
  );

  // enqueue work
  await ordersQueue.add(
    "execute",
    { orderId, ...body },
    { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
  );

  return { orderId };
});


// -------------------------------------------------------
// WebSocket route (in plugin to enable connection.send())
// -------------------------------------------------------
fastify.register(async function (fastify) {
  const WsQuerySchema = Type.Object({
    orderId: Type.String()
  });

  type WsQueryType = Static<typeof WsQuerySchema>;

  fastify.get("/api/orders/ws", {
    websocket: true, schema: {
      querystring: WsQuerySchema
    }
  }, (connection, req: FastifyRequest<{
    Querystring: WsQueryType;
  }>) => {
    const { orderId } = req.query;

    if (!orderId) {
      connection.send(JSON.stringify({ status: "failed", error: "Missing orderId" }));
      connection.close();
      return;
    }

    // Add this WS client to tracking map
    if (!wsClients.has(orderId)) wsClients.set(orderId, new Set());
    wsClients.get(orderId)!.add(connection);

    // Send initial pending state or snapshot from Redis
    (async () => {
      const snapshot = await redis.hgetall(`order:${orderId}`);
      if (Object.keys(snapshot).length > 0) {
        connection.send(JSON.stringify({ type: "snapshot", data: snapshot }));
      } else {
        connection.send(JSON.stringify({ status: "pending", orderId }));
      }
    })();

    connection.on("close", () => {
      const set = wsClients.get(orderId);
      if (!set) return;
      set.delete(connection);
      if (set.size === 0) wsClients.delete(orderId);
    });
  });
});

// -------------------------------------------------------
// GET /api/orders
// -------------------------------------------------------
fastify.get("/api/orders", async (req, reply) => {
  const r = await pool.query("SELECT * FROM orders");
  if (r.rowCount === 0) return reply.status(404).send({ error: "Not Found" });
  return r.rows;
});

// -------------------------------------------------------
// GET /api/orders/:id
// -------------------------------------------------------
const opts = {
  schema: {
    params: Type.Object({
      id: Type.String()
    })
  }
};

fastify.get("/api/orders/:id", opts, async (req, reply) => {
  const id = req.params.id;
  const r = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);

  if (r.rowCount === 0) return reply.status(404).send({ error: "Not found" });
  return r.rows[0];
});

// -------------------------------------------------------
// Test endpoint
// -------------------------------------------------------
fastify.get("/api/test", async () => ({ msg: "Hello, server is working!!!" }));

// -------------------------------------------------------
// Start server
// -------------------------------------------------------
const start = async () => {
  await initDb();
  const port = +(process.env.PORT || 3000);
  await fastify.listen({ port, host: "0.0.0.0" });
  await redisSub.subscribe("order_updates");
};

start();
