import { randomUUID } from "crypto";
import { OrdersRepo } from "./orders.repo";
import { ordersQueue } from "./orders.queue";
import { OrderRequest } from "../../types/orders.types";

export const OrdersController = {
  async executeOrder(body: OrderRequest) {
    const orderId = randomUUID();

    await OrdersRepo.create(orderId, body);

    await ordersQueue.add(
      "execute",
      { orderId, ...body },
      { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
    );

    return { orderId };
  },

  async getAll() {
    const r = await OrdersRepo.findAll();
    return r.rows;
  },

  async getOne(id: string) {
    const r = await OrdersRepo.findById(id);
    if (r.rowCount === 0) return null;
    return r.rows[0];
  }
};
