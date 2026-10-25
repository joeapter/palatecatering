-- Custom delivery dates: an order for a day that is not a Shabbos or Yom Tov.
--
-- These are ordinary order windows, created on demand for one customer's date,
-- so everything downstream — cutoff enforcement, the kitchen list, per-window
-- revenue — works without a second concept to maintain.
--
-- Two things keep them from behaving like the weekly windows:
--
--   is_custom  keeps them out of the storefront's window list, which every
--              customer sees. Without it, one person choosing a Tuesday would
--              put that Tuesday in front of everybody.
--
--   event_type stays 'shabbos' on purpose. Checkout validates that each dish is
--              on the menu for the window's event_type, so a type of 'custom'
--              would match no product's tags and reject the entire order.

BEGIN;

ALTER TABLE order_windows
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;

-- The storefront asks for non-custom windows on every page that offers
-- ordering, and the lookup below finds an existing custom date before creating
-- another one for the same day.
CREATE INDEX IF NOT EXISTS order_windows_custom_idx
  ON order_windows (is_custom, event_date);

COMMIT;
