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

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE orders
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS slippage_pct TEXT;
