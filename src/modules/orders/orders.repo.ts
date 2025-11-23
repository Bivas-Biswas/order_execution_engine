import { pool } from "../../db";

export const OrdersRepo = {
  create(orderId: string, body: any) {
    return pool.query(
      "INSERT INTO orders (id, input_mint, output_mint, amount, status) VALUES ($1,$2,$3,$4,$5)",
      [orderId, body.inputMint, body.outputMint, body.amount, "pending"]
    );
  },

  findAll() {
    return pool.query("SELECT * FROM orders");
  },

  findById(id: string) {
    return pool.query("SELECT * FROM orders WHERE id=$1", [id]);
  }
};
