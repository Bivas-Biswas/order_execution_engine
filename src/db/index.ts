import { Pool } from 'pg';
import { readFile } from "fs/promises";
import path from "path";

import { env } from '../config/env';

const connectionString = env.db.url;

export const pool = new Pool({ connectionString });


export async function initDb() {
    const filePath = path.join(__dirname, "../migrations/002_create_order.sql");

    const sql = await readFile(filePath, "utf8");

    await pool.query(sql);
}


export default pool;

