BEGIN;

CREATE TABLE IF NOT EXISTS cook_days (
  id serial PRIMARY KEY,
  cook_date date NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cook_items (
  id bigserial PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('palate', 'caterbase')),
  source_order_id text NOT NULL,
  source_line_key text NOT NULL,
  source_order_label text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  event_date date,
  meal_name text NOT NULL DEFAULT '',
  item_name text NOT NULL,
  sold_by text NOT NULL DEFAULT '',
  quantity numeric(12,3),
  adult_count integer,
  child_count integer,
  notes text NOT NULL DEFAULT '',
  cook_day_id integer REFERENCES cook_days(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_order_id, source_line_key)
);

CREATE INDEX IF NOT EXISTS cook_items_assignment_idx ON cook_items (completed, cook_day_id, event_date);
CREATE INDEX IF NOT EXISTS cook_items_source_idx ON cook_items (source_type, source_order_id);

COMMIT;
