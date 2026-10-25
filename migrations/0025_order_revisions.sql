-- Editing an order that has already been saved.
--
-- Manual orders are how a quote gets recorded, and a quote changes: the
-- customer adds a kugel, drops the brisket, moves the date. Until now the only
-- way to change one was to delete it and type it again, which loses the order
-- number the customer was given and any record that it changed at all.
--
-- `revision` counts the times an order has been re-saved, so a printed sheet
-- can say which version it is, and `updated_at` says when — the two things that
-- settle an argument about which quote the customer is holding.

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

COMMIT;
