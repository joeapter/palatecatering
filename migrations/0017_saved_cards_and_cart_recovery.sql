-- Saved cards, and abandoned-cart recovery for the new storefront.
--
-- Two features, one migration, because both hang off the same idea: knowing who
-- a shopper is between visits.
--
-- Saved cards: the card itself is never stored here. Stripe vaults it and we
-- keep only the customer reference (`cus_...`), which is worthless on its own.
-- That keeps card data entirely inside Stripe's PCI scope, which is the whole
-- point of doing it this way.
--
-- Cart recovery: `abandoned_carts` already exists and is already wired into the
-- old admin, so the new storefront writes into the same table rather than a
-- parallel one. Adding to it means one recovery list covers both sites during
-- the cutover instead of two half-lists.

BEGIN;

-- ---------------------------------------------------------------- saved cards
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- One Stripe customer per account. Partial so the many NULLs (everyone who has
-- never saved a card) do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_key
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ------------------------------------------------------------ cart recovery
ALTER TABLE abandoned_carts
  -- Which Shabbos they were shopping for. Without it the reminder schedule
  -- cannot know when the cutoff is, and the cutoff is what the whole sequence
  -- is anchored to.
  ADD COLUMN IF NOT EXISTS order_window_id integer,
  ADD COLUMN IF NOT EXISTS user_id integer,
  -- Single-use-ish secret in the recovery link, so a reminder can restore the
  -- cart without exposing a guessable id or requiring a login.
  ADD COLUMN IF NOT EXISTS recovery_token text,
  ADD COLUMN IF NOT EXISTS reminders_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_stage text,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  -- Why the sequence stopped: 'ordered', 'cutoff_passed', 'unsubscribed',
  -- 'dismissed', 'exhausted'. Recorded so the admin view can explain itself
  -- rather than just showing a silent gap.
  ADD COLUMN IF NOT EXISTS reminder_stop_reason text,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS abandoned_carts_recovery_token_key
  ON abandoned_carts (recovery_token)
  WHERE recovery_token IS NOT NULL;

-- The sweep runs on a schedule and asks the same question every time: which
-- open carts with an email are due a reminder? This is that question's index.
CREATE INDEX IF NOT EXISTS abandoned_carts_due_idx
  ON abandoned_carts (status, reminders_sent, last_seen_at)
  WHERE customer_email IS NOT NULL AND customer_email <> '';

-- Every send, including failures. The admin view reports from this, so a
-- reminder that bounced is visible rather than assumed delivered.
CREATE TABLE IF NOT EXISTS cart_reminder_log (
  id serial PRIMARY KEY,
  cart_id text NOT NULL,
  stage text NOT NULL,
  email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  error text,
  -- Set when this cart later turns into an order, so recovered revenue can be
  -- attributed to the stage that actually did the work.
  recovered_order_id integer,
  recovered_at timestamptz
);

CREATE INDEX IF NOT EXISTS cart_reminder_log_cart_idx ON cart_reminder_log (cart_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS cart_reminder_log_sent_idx ON cart_reminder_log (sent_at DESC);

-- A cart may only ever receive a given stage once, however often the sweep
-- runs. This is the backstop: if the scheduler double-fires or two instances
-- overlap, the database refuses the duplicate rather than mailing twice.
CREATE UNIQUE INDEX IF NOT EXISTS cart_reminder_log_once_idx
  ON cart_reminder_log (cart_id, stage)
  WHERE ok = true;

COMMIT;
