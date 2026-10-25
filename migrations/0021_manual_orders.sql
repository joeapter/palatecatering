-- Orders taken by hand: over the phone, at the door, or for a simcha quoted
-- outside the shop.
--
-- These are not new to the business, only new to this system — they were being
-- typed into the old admin. What was missing is any record of *how* they were
-- paid, which is why the dashboard's Stripe and booked figures diverge with no
-- explanation attached to the individual order.

BEGIN;

ALTER TABLE orders
  -- 'bit', 'cash', 'bank_transfer', 'zelle', 'card_in_person', 'unpaid', or
  -- 'stripe' for anything the storefront took. Free text rather than an enum:
  -- a new way of being paid should not require a migration.
  ADD COLUMN IF NOT EXISTS payment_method text,
  -- Distinguishes an order typed in by staff from one a customer placed. Both
  -- are real orders; only the manual ones need a payment method recorded and
  -- an invoice sent.
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by text;

-- Everything already in the table came through the storefront or the old
-- payment-link flow, so it was paid by card through Stripe.
UPDATE orders SET payment_method = 'stripe' WHERE payment_method IS NULL;

CREATE INDEX IF NOT EXISTS orders_manual_idx ON orders (is_manual, created_at DESC);

COMMIT;
