CREATE TABLE IF NOT EXISTS abandoned_carts (
  id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  status text DEFAULT 'open',
  source text,
  page_url text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  delivery_type text,
  shabbos_label text,
  allergies text,
  notes text,
  total text,
  item_count integer DEFAULT 0,
  items jsonb DEFAULT '[]'::jsonb,
  payload jsonb DEFAULT '{}'::jsonb,
  order_id integer,
  ordered_at timestamptz,
  contacted_at timestamptz,
  dismissed_at timestamptz,
  payment_link_id text,
  payment_link_url text,
  payment_link_order_id integer,
  payment_link_created_at timestamptz,
  admin_notes text
);

CREATE INDEX IF NOT EXISTS abandoned_carts_status_last_seen_idx
  ON abandoned_carts (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS abandoned_carts_contact_idx
  ON abandoned_carts (customer_email, customer_phone);
