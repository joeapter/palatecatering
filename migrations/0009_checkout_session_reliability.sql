BEGIN;

-- Completion is now claimed atomically and can be driven by either the browser
-- or the Stripe webhook. These columns make a stuck or failed completion
-- visible instead of silent: a paid checkout_session that never reaches
-- 'complete' is money taken without an order, and it must be findable.
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS completed_by text;

-- status now moves pending -> processing -> complete, with 'failed' as a
-- re-claimable state. Anything sitting in processing/failed with a succeeded
-- PaymentIntent needs a human.
CREATE INDEX IF NOT EXISTS checkout_sessions_needs_attention_idx
  ON checkout_sessions (status, updated_at)
  WHERE status <> 'complete';

COMMIT;
