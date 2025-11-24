import { pool } from '../../db';
import { OrderRequest } from '../../types/orders.types';

export const OrdersRepo = {
  create(orderId: string, body: OrderRequest) {
    return pool.query(
      'INSERT INTO orders (id, input_mint, output_mint, amount, status, slippage_pct) VALUES ($1,$2,$3,$4,$5,$6)',
      [orderId, body.inputMint, body.outputMint, body.amount, 'pending', body.slippage_pct || null],
    );
  },

  findAll() {
    return pool.query('SELECT * FROM orders');
  },

  findById(id: string) {
    return pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  },
};
