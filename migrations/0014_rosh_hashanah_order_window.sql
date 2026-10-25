BEGIN;

-- Rosh Hashanah needs its own order window, otherwise the holiday menu has no
-- date to be ordered for and would be bought against a regular Shabbos.
--
-- Rosh Hashanah 5787 begins Friday evening 11 September 2026 and runs to
-- Sunday night 13 September. Delivery therefore has to land on the Friday,
-- before candle lighting. Cutoff below is PROVISIONAL — confirm before launch.
INSERT INTO order_windows (name, slug, event_type, event_date, opens_at, cutoff_at, active)
SELECT 'Rosh Hashanah · Sep 11', 'rosh-hashanah-2026', 'rosh-hashanah',
       DATE '2026-09-11',
       now(),
       TIMESTAMPTZ '2026-09-08 23:59:00+03',
       true
WHERE NOT EXISTS (SELECT 1 FROM order_windows WHERE slug = 'rosh-hashanah-2026');

COMMIT;
