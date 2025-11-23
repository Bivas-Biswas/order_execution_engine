import { FastifyInstance } from "fastify";
import { OrdersController } from "./orders.controller";
import { OrderRequestSchema, OrderRequest, FetchOrderRequest, FetchOrderRequestSchema } from "../../types/orders.types";

export async function registerOrderRoutes(fastify: FastifyInstance) {

  fastify.post<{
    Body: OrderRequest
  }>(
    "/api/orders/execute",
    {
      schema: { body: OrderRequestSchema }
    },
    async (req, reply) => {
      const result = await OrdersController.executeOrder(req.body);
      return result;
    }
  );



  fastify.get("/api/orders", async () => {
    return OrdersController.getAll();
  });


  fastify.get<{ Params: FetchOrderRequest }>("/api/orders/:id", {
    schema: {
      params: FetchOrderRequestSchema
    }
  }, async (req, reply) => {
    const row = await OrdersController.getOne(req.params.id);
    if (!row) return reply.status(404).send({ error: "Not found" });
    return row;
  });
}
