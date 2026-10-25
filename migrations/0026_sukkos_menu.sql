-- The Sukkos 5787 menu, and closing Rosh Hashanah for the year.
--
-- Sukkos is cooked from the Rosh Hashanah menu, so the dishes are COPIED
-- rather than re-tagged: the Rosh Hashanah rows stay exactly as they are, with
-- their own prices and their own order history attached, ready to be brought
-- back next Elul. Editing a Sukkos price from here on leaves Rosh Hashanah
-- untouched, which is the point of copying.
--
-- Two dishes do not carry over. The short ribs are off the menu, and the
-- Simanim Platter belongs to Rosh Hashanah night — neither is deleted, both
-- simply are not copied.
--
-- Re-runnable: every insert checks for what it would create.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The dishes, copied from Rosh Hashanah.
-- ---------------------------------------------------------------------------

INSERT INTO products (
  category, title, description, price, sold_by, qty_label, image_url,
  active, menu_tags, needs_price_review, category_id, slug, badge, serves, sort_order
)
SELECT
  rh.category, rh.title, rh.description, rh.price, rh.sold_by, rh.qty_label, rh.image_url,
  true, ARRAY['sukkos']::text[], false, rh.category_id,
  -- The slug carries the season it belongs to, as the Rosh Hashanah ones do.
  replace(rh.slug, 'rh26-', 'suk26-'), rh.badge, rh.serves, rh.sort_order
FROM products rh
WHERE rh.menu_tags @> ARRAY['rosh-hashanah']::text[]
  AND rh.active = true
  AND rh.title NOT IN ('Korean BBQ Short Ribs', 'Simanim Platter')
  AND NOT EXISTS (
    SELECT 1 FROM products existing
    WHERE existing.menu_tags @> ARRAY['sukkos']::text[] AND existing.title = rh.title
  );

-- Their sizes and prices, copied with them.
INSERT INTO product_variants (
  product_id, label, sold_by, price, sku, sort_order, active,
  unit_type, unit_value, unit_label, minimum_quantity, quantity_step,
  maximum_quantity, serves_min, serves_max
)
SELECT
  suk.id, v.label, v.sold_by, v.price, NULL, v.sort_order, v.active,
  v.unit_type, v.unit_value, v.unit_label, v.minimum_quantity, v.quantity_step,
  v.maximum_quantity, v.serves_min, v.serves_max
FROM product_variants v
JOIN products rh ON rh.id = v.product_id AND rh.menu_tags @> ARRAY['rosh-hashanah']::text[]
JOIN products suk ON suk.title = rh.title AND suk.menu_tags @> ARRAY['sukkos']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants existing
  WHERE existing.product_id = suk.id AND existing.label = v.label
);

-- ---------------------------------------------------------------------------
-- 2. New for Sukkos.
-- ---------------------------------------------------------------------------

INSERT INTO products (category, title, description, price, sold_by, image_url, active, menu_tags, needs_price_review, slug, sort_order)
SELECT * FROM (VALUES
  ('Sides',   'Majadera',                     '', 160.00, '9x13 Pan',  '', true, ARRAY['sukkos']::text[], false, 'suk26-majadera',                    30),
  ('Meat',    'Unstuffed Cabbage',            '', 385.00, '9x13 Pan',  '', true, ARRAY['sukkos']::text[], false, 'suk26-unstuffed-cabbage',           31),
  ('Chicken', 'Stuffed Capons',               '', 420.00, '9x13 Pan',  '', true, ARRAY['sukkos']::text[], false, 'suk26-stuffed-capons',              32),
  ('Fish',    'Sweet & Sour Pickled Salmon',  '', 160.00, '4 Fillets', '', true, ARRAY['sukkos']::text[], false, 'suk26-sweet-sour-pickled-salmon',   33),
  ('Fish',    'Moroccan Gefilte Fish Balls',  '', 330.00, '9x13 Pan',  '', true, ARRAY['sukkos']::text[], false, 'suk26-moroccan-gefilte-fish-balls', 34)
) AS new_dish(category, title, description, price, sold_by, image_url, active, menu_tags, needs_price_review, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM products existing
  WHERE existing.menu_tags @> ARRAY['sukkos']::text[] AND existing.title = new_dish.title
);

-- A full pan and a half of it, priced as quoted. The full pan comes first
-- because that is the size these are sold in; the half is the alternative.
INSERT INTO product_variants (product_id, label, sold_by, price, sort_order, active, unit_type, unit_label, minimum_quantity, quantity_step)
SELECT p.id, size.label, size.label, size.price, size.sort_order, true, 'container', size.label, 1, 1
FROM products p
JOIN (VALUES
  ('Majadera',                    '9x13 Pan',  160.00, 1),
  ('Majadera',                    'Half Pan',   80.00, 2),
  ('Unstuffed Cabbage',           '9x13 Pan',  385.00, 1),
  ('Unstuffed Cabbage',           'Half Pan',  195.00, 2),
  ('Stuffed Capons',              '9x13 Pan',  420.00, 1),
  ('Stuffed Capons',              'Half Pan',  210.00, 2),
  ('Sweet & Sour Pickled Salmon', '4 Fillets', 160.00, 1),
  ('Moroccan Gefilte Fish Balls', '9x13 Pan',  330.00, 1)
) AS size(title, label, price, sort_order) ON size.title = p.title
WHERE p.menu_tags @> ARRAY['sukkos']::text[]
  AND NOT EXISTS (
    SELECT 1 FROM product_variants existing
    WHERE existing.product_id = p.id AND existing.label = size.label
  );

-- ---------------------------------------------------------------------------
-- 3. Ordering: Sukkos opens, Rosh Hashanah closes.
-- ---------------------------------------------------------------------------

-- Erev Sukkos, Friday 25 September. Orders close Monday 21 September at 23:59
-- Jerusalem time, which is 20:59 UTC while Israel is on daylight time — the
-- same way every other window in this table is stored.
INSERT INTO order_windows (name, slug, event_type, event_date, opens_at, cutoff_at, active)
VALUES ('Sukkos · Sep 25', 'sukkos-2026', 'sukkos', '2026-09-25', now(), '2026-09-21 20:59:00+00', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, event_type = EXCLUDED.event_type, event_date = EXCLUDED.event_date,
  cutoff_at = EXCLUDED.cutoff_at, active = true;

-- Rosh Hashanah is over. The window closes so nothing can be ordered against
-- it; the dishes themselves are left alone.
UPDATE order_windows SET active = false WHERE slug = 'rosh-hashanah-2026';

-- The home page still leads with Rosh Hashanah. Point it at the menu that is
-- actually open.
UPDATE hero_slides
SET eyebrow = 'Sukkos',
    headline = 'Yom tov in the succah, already cooked.',
    cta_label = 'See the Sukkos menu',
    cta_href = '/holidays/sukkos'
WHERE cta_href = '/holidays/rosh-hashanah';

COMMIT;
