-- Any dish, any open date.
--
-- Checkout used to refuse a basket that mixed menus: a Shabbos dish could not
-- be bought against a Sukkos date, or the other way round, on the reasoning
-- that the kitchen cooks one menu that week. In practice it cooks both — erev
-- Sukkos is also erev Shabbos — and a customer keeping second day yom tov had
-- her whole basket refused over a container of chummus.
--
-- Maya's call: it does not matter which menu a dish came from, only that it is
-- on sale and the date is open. The check is gone from checkout, so the
-- `accepts_menus` column added earlier today to describe exceptions to a rule
-- that no longer exists is dropped with it.

BEGIN;

ALTER TABLE order_windows
  DROP COLUMN IF EXISTS accepts_menus;

COMMIT;
