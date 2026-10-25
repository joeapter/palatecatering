BEGIN;

-- Repairs products that lost their Shabbos menu membership.
--
-- Historically a product with menu_tags NULL/empty meant "Shabbos": the Shabbos
-- query matches `menu_tags @> ARRAY['shabbos'] OR menu_tags IS NULL`. The Rosh
-- Hashanah seeder saw NULL, treated it as "no tags yet", and wrote
-- ARRAY['rosh-hashanah'] — which is no longer NULL and does not contain
-- 'shabbos', so those products silently vanished from the Shabbos menu and
-- every /shabbos/<category> page 404'd.
--
-- The seeder now writes ARRAY['shabbos','rosh-hashanah'] in that case. This
-- backfills rows already written the old way.
--
-- Only genuinely-new Rosh Hashanah items are excluded; everything else tagged
-- rosh-hashanah came from the Shabbos menu and must keep that tag.
UPDATE products
SET menu_tags = array_append(menu_tags, 'shabbos')
WHERE menu_tags @> ARRAY['rosh-hashanah']::text[]
  AND NOT (menu_tags @> ARRAY['shabbos']::text[])
  AND category <> 'Rosh Hashanah Specials';

COMMIT;
