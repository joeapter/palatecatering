-- Records that someone has been told about a paid checkout that produced no
-- order, so the alert is sent once rather than on every retry.
--
-- The column doubles as the dedupe lock: claiming it with a conditional UPDATE
-- is what stops the browser path and the Stripe webhook — which both run the
-- same completion routine, often seconds apart — from each sending their own
-- copy of the same alarming email.

BEGIN;

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS alerted_at timestamptz,
  -- Why the alert was raised, kept so the admin can show what went wrong
  -- without re-reading a truncated HTML error page.
  ADD COLUMN IF NOT EXISTS alert_reason text;

-- The sweep asks for paid-but-incomplete sessions that have not been alerted.
CREATE INDEX IF NOT EXISTS checkout_sessions_unalerted_idx
  ON checkout_sessions (status, created_at)
  WHERE alerted_at IS NULL;

COMMIT;
