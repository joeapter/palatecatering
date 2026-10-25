BEGIN;

CREATE TABLE IF NOT EXISTS checkout_sessions (
  payment_intent_id text PRIMARY KEY,
  order_window_id integer NOT NULL REFERENCES order_windows(id),
  payload jsonb NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_sessions_status_created_idx ON checkout_sessions (status, created_at);

COMMIT;
