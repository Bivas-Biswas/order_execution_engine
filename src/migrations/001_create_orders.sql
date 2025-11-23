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