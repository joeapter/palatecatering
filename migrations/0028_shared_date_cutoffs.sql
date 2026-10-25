-- When two windows share a date, they share a deadline.
--
-- Erev Sukkos is also erev Shabbos, and both windows were offered for Friday
-- 25 September: Sukkos closing Monday the 21st, plain Shabbos closing Wednesday
-- the 23rd. Since any dish can now be ordered for any open date (0027), the
-- later deadline was simply a way around the earlier one — order the same food
-- against "Shabbos · Sep 25" and get two extra days on a cook run that closed
-- on Monday. The kitchen cooks it all on the one Friday either way.
--
-- So: on any date carrying a holiday window, every window for that date takes
-- the earliest cutoff of the group. Both windows stay orderable and keep their
-- own names and their own order history — this only aligns the deadline.
--
-- Custom dates are left out. A bris on the same Friday is one customer's own
-- window, created on demand with its own two-day rule, and is not a route round
-- anything.
--
-- Re-runnable: it only ever moves a cutoff earlier, to a value already present
-- on the date, so running it twice changes nothing the second time.

BEGIN;

UPDATE order_windows s
SET cutoff_at = shared.earliest,
    updated_at = now()
FROM (
  SELECT event_date, MIN(cutoff_at) AS earliest
  FROM order_windows
  WHERE active = true
    AND COALESCE(is_custom, false) = false
  GROUP BY event_date
  -- Only where a holiday actually shares the date with something else.
  HAVING COUNT(*) > 1
     AND COUNT(*) FILTER (WHERE event_type <> 'shabbos') > 0
) AS shared
WHERE s.event_date = shared.event_date
  AND s.active = true
  AND COALESCE(s.is_custom, false) = false
  AND s.cutoff_at > shared.earliest;

COMMIT;
