import { Pool } from 'pg';

const connectionString = process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/market_orders';
export const pool = new Pool({ connectionString });


export async function initDb() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    input_mint TEXT NOT NULL,
    output_mint TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    venue TEXT,
    execution_price NUMERIC,
    tx_hash TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
`);
}


export default pool;

