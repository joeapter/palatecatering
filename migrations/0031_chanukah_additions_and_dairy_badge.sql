-- Chanukah 2026: the three dishes on the printed menu that 0030 did not have,
-- and a Dairy badge on the halloumi salad.
--
-- Scallion Pancakes, Chinese Fried Rice and Beer Battered Chicken Nuggets are
-- priced per pan, as printed. The salad's "Dairy" moves out of the fine print
-- into `badge`, which the holiday menu shows as a blue pill beside the name;
-- its description becomes the printed one.
--
-- Re-runnable: inserts check for what they would create, updates set fixed values.

BEGIN;

CREATE TEMP TABLE chanukah_additions (
  sort_order  integer,
  category    text,
  title       text,
  description text,
  sold_by     text,
  price       numeric
) ON COMMIT DROP;

INSERT INTO chanukah_additions VALUES
  (22, 'Savory Specialties', 'Scallion Pancakes',             'Crispy scallion pancakes.',            'Pan', 225.00),
  (23, 'Savory Specialties', 'Chinese Fried Rice',            'Classic vegetable fried rice.',        'Pan', 190.00),
  (24, 'Savory Specialties', 'Beer Battered Chicken Nuggets', 'Crispy beer-battered chicken nuggets.', 'Pan', 240.00);

INSERT INTO products (category, title, description, price, sold_by, qty_label,
                      image_url, menu_tags, active, needs_price_review, slug, sort_order)
SELECT m.category, m.title, m.description, m.price, m.sold_by, 'Order Qty',
       '', ARRAY['chanukah']::text[], true, false,
       'chan26-' || trim(both '-' from lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g'))),
       m.sort_order
FROM chanukah_additions m
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.menu_tags @> ARRAY['chanukah']::text[] AND p.title = m.title
);

INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                              minimum_quantity, quantity_step, active, sort_order)
SELECT p.id, m.sold_by, m.sold_by, m.price, 'container', m.sold_by, 1, 1, true, 1
FROM chanukah_additions m
JOIN products p ON p.title = m.title AND p.menu_tags @> ARRAY['chanukah']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.label = m.sold_by
);

UPDATE products
SET badge = 'Dairy',
    description = 'Crispy sweet potato ribbons, halloumi, greens & a house dressing.'
WHERE menu_tags @> ARRAY['chanukah']::text[]
  AND title = 'Fried Sweet Potato & Halloumi Salad';

COMMIT;
