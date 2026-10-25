BEGIN;

-- Shabbos order windows for a year ahead, with the cutoff the business actually
-- uses: Wednesday 23:59 Israel time (three days before Shabbos), matching the
-- legacy shabbos_close_days_before / shabbos_close_time convention.
--
-- Times are written as Israel local time and converted with AT TIME ZONE
-- 'Asia/Jerusalem' so Postgres applies the right offset either side of the
-- daylight-saving change. The earlier seed stored 19:00 UTC, which surfaced as
-- 22:00 Israel — the bug this migration fixes.

-- 1. Correct the cutoffs already seeded.
UPDATE order_windows
SET cutoff_at = ((event_date - INTERVAL '2 days')::date + TIME '23:59') AT TIME ZONE 'Asia/Jerusalem'
WHERE event_type = 'shabbos';

-- 2. One window per Friday for the next 52 weeks.
--    `opens_at` six weeks before the date is what limits customers to booking
--    six weeks ahead, while the rows themselves exist for the full year so the
--    kitchen can plan and the admin can edit them.
INSERT INTO order_windows (name, slug, event_type, event_date, opens_at, cutoff_at, active)
SELECT
  'Shabbos · ' || to_char(d, 'Mon FMDD'),
  'shabbos-' || to_char(d, 'YYYY-MM-DD'),
  'shabbos',
  d::date,
  ((d - INTERVAL '6 weeks')::date + TIME '00:00') AT TIME ZONE 'Asia/Jerusalem',
  ((d - INTERVAL '2 days')::date + TIME '23:59') AT TIME ZONE 'Asia/Jerusalem',
  true
FROM generate_series(
       -- the next Friday on or after today
       (CURRENT_DATE + ((5 - EXTRACT(dow FROM CURRENT_DATE)::int + 7) % 7))::timestamp,
       (CURRENT_DATE + ((5 - EXTRACT(dow FROM CURRENT_DATE)::int + 7) % 7) + INTERVAL '52 weeks')::timestamp,
       INTERVAL '7 days'
     ) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM order_windows ow
  WHERE ow.event_type = 'shabbos' AND ow.event_date = d::date
);

-- 3. A holiday window replaces the plain Shabbos window on the same date —
--    Rosh Hashanah begins Friday evening, so offering both would ask the
--    customer to choose between two names for one meal.
UPDATE order_windows s
SET active = false
FROM order_windows h
WHERE s.event_type = 'shabbos'
  AND h.event_type <> 'shabbos'
  AND h.active = true
  AND h.event_date = s.event_date;

COMMIT;
