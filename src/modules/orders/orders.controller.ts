import { randomUUID } from 'crypto';

import { redis } from '../../config/redis';
import { OrderRequest } from '../../types/orders.types';
import { ordersQueue } from './orders.queue';
import { OrdersRepo } from './orders.repo';

export const OrdersController = {
  async executeOrder(body: OrderRequest) {
    const orderId = randomUUID();

    await OrdersRepo.create(orderId, body);

    await redis.set(orderId, 1, 'EX', 10);

    await ordersQueue.add('execute', { orderId, ...body });

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
  },
};
