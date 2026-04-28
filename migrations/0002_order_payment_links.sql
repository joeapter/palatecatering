ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_payment_link text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_payment_url text;
