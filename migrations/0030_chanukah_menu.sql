-- The Chanukah 2026 takeout menu opens, and Sukkos closes for the year.
--
-- Every item, size and price below is transcribed from the menu as sent by the
-- owner. Products are tagged `chanukah` and slugged `chan26-`, the way the
-- Rosh Hashanah and Sukkos dishes carry their season.
--
-- No order window is created here: the menu went up without a delivery date or
-- order deadline. Since any dish can be ordered for any open date (0027), the
-- dishes can be bought against the open Shabbos dates until a Chanukah window
-- is added from the admin.
--
-- Re-runnable: every insert checks for what it would create.

BEGIN;

CREATE TEMP TABLE chanukah_menu (
  sort_order  integer,
  category    text,
  title       text,
  description text,
  sold_by     text,
  price       numeric
) ON COMMIT DROP;

INSERT INTO chanukah_menu VALUES
  -- LATKES
  (10, 'Latkes',             'Classic Potato Latkes',                 '15 crispy, golden potato latkes.',                                                       '15 Latkes', 180.00),
  (11, 'Latkes',             'Sweet Potato Latkes',                   '15 sweet potato latkes.',                                                                '15 Latkes', 180.00),
  (12, 'Latkes',             'Ultimate Latke Platter',                '15 latkes served with pulled beef, caramelized onions, garlic aioli & pickled red onions.', '15 Latkes', 420.00),

  -- SAVORY SPECIALTIES
  (20, 'Savory Specialties', 'Beef Empanadas',                        '9x13 pan.',                                                                              '9x13 Pan',  240.00),
  (21, 'Savory Specialties', 'Egg Rolls',                             '9x13 pan · approximately 16 pieces.',                                                    '9x13 Pan',  225.00),

  -- SALADS
  (30, 'Salads',             'Fried Sweet Potato & Halloumi Salad',   '3 liters · Dairy.',                                                                      '3 Liters',  240.00);

INSERT INTO products (category, title, description, price, sold_by, qty_label,
                      image_url, menu_tags, active, needs_price_review, slug, sort_order)
SELECT m.category, m.title, m.description, m.price, m.sold_by, 'Order Qty',
       '', ARRAY['chanukah']::text[], true, false,
       'chan26-' || trim(both '-' from lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g'))),
       m.sort_order
FROM chanukah_menu m
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.menu_tags @> ARRAY['chanukah']::text[] AND p.title = m.title
);

-- One size per dish, as a variant, so the cart always references a variant.
INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                              minimum_quantity, quantity_step, active, sort_order)
SELECT p.id, m.sold_by, m.sold_by, m.price, 'container', m.sold_by, 1, 1, true, 1
FROM chanukah_menu m
JOIN products p ON p.title = m.title AND p.menu_tags @> ARRAY['chanukah']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.label = m.sold_by
);

-- Sukkos is over. Its window closes so nothing can be ordered against it; the
-- dishes themselves are left alone, ready for next year, as Rosh Hashanah's were.
UPDATE order_windows SET active = false WHERE slug = 'sukkos-2026';

-- The home page still leads with Sukkos, which is long over. Point it at the
-- menu that is actually open.
UPDATE hero_slides
SET eyebrow = 'Chanukah',
    headline = 'Eight nights, the latkes already fried.',
    cta_label = 'See the Chanukah menu',
    cta_href = '/holidays/chanukah'
WHERE cta_href = '/holidays/sukkos';

COMMIT;
