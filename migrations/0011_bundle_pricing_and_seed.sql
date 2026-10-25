BEGIN;

-- Bundle prices are a judgement call, not a calculation: they are set below from
-- the à-la-carte total minus a discount, which is a proposal, not Palate's
-- pricing. Same rule as seasonal products — a generated price is flagged and the
-- bundle stays inactive until someone confirms it.
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS needs_price_review boolean NOT NULL DEFAULT false;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS serves_min integer;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS serves_max integer;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS menu text NOT NULL DEFAULT 'shabbos';

CREATE INDEX IF NOT EXISTS bundles_active_sort_idx ON bundles (active, sort_order);

-- Helper: resolve a product by title, and its cheapest active variant.
-- Bundle rows are skipped rather than half-built if a product is missing.
INSERT INTO bundles (name, slug, description, price, serves, serves_min, serves_max, sort_order, active, needs_price_review, image_url)
VALUES
  ('Shabbos Essentials', 'shabbos-essentials',
   'The backbone of a Shabbos table — two salatim, soup, fish, a kugel and a main. Enough for a family meal without deciding every dish.',
   420, 'Serves 4–6', 4, 6, 1, false, true, '/assets/Shabbos/Chicken-Soup.jpg'),
  ('The Full Shabbos Table', 'full-shabbos-table',
   'Both nights covered: four salatim, soup, gefilte fish, kugel, chicken and brisket. Built for a full table with guests.',
   850, 'Serves 8–10', 8, 10, 2, false, true, '/assets/Shabbos/Balsamic Glazed Brisket.jpg'),
  ('Kiddush Spread', 'kiddush-spread',
   'A shul or simcha kiddush — salatim, deli roll, meat cigars, a composed salad and kugel, arranged to serve a crowd.',
   720, 'Serves 15–20', 15, 20, 3, false, true, '/assets/Shabbos/Deli Roll.jpg')
ON CONFLICT (slug) DO NOTHING;

-- Contents, resolved against real products so nothing references a made-up item.
WITH picks(bundle_slug, product_title, qty, sort_order) AS (
  VALUES
    ('shabbos-essentials', 'Chummus', 1, 1),
    ('shabbos-essentials', 'Techina', 1, 2),
    ('shabbos-essentials', 'Chicken Soup', 1, 3),
    ('shabbos-essentials', 'Gefilte Fish', 1, 4),
    ('shabbos-essentials', 'Potato Kugel', 1, 5),
    ('shabbos-essentials', 'Grilled Chicken White', 1, 6),

    ('full-shabbos-table', 'Chummus', 1, 1),
    ('full-shabbos-table', 'Techina', 1, 2),
    ('full-shabbos-table', 'Beet Salad', 1, 3),
    ('full-shabbos-table', 'Coleslaw', 1, 4),
    ('full-shabbos-table', 'Chicken Soup', 2, 5),
    ('full-shabbos-table', 'Gefilte Fish', 1, 6),
    ('full-shabbos-table', 'Potato Kugel', 1, 7),
    ('full-shabbos-table', 'Apricot Chicken', 1, 8),
    ('full-shabbos-table', 'Balsamic Glazed Brisket', 1, 9),

    ('kiddush-spread', 'Chummus', 1, 1),
    ('kiddush-spread', 'Techina', 1, 2),
    ('kiddush-spread', 'Eggplant with Tehina', 1, 3),
    ('kiddush-spread', 'Olive Dip', 1, 4),
    ('kiddush-spread', 'Deli Roll', 1, 5),
    ('kiddush-spread', 'Meat Cigars', 1, 6),
    ('kiddush-spread', 'Sweet Pecan Salad', 1, 7),
    ('kiddush-spread', 'Potato Kugel', 1, 8)
)
INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity, sort_order, required)
SELECT b.id,
       p.id,
       (SELECT pv.id FROM product_variants pv
         WHERE pv.product_id = p.id AND pv.active = true
         ORDER BY pv.sort_order, pv.id LIMIT 1),
       picks.qty,
       picks.sort_order,
       true
FROM picks
JOIN bundles b ON b.slug = picks.bundle_slug
JOIN LATERAL (
  SELECT id FROM products
   WHERE title = picks.product_title AND active = true
   ORDER BY id LIMIT 1
) p ON true
WHERE NOT EXISTS (
  SELECT 1 FROM bundle_items bi WHERE bi.bundle_id = b.id AND bi.sort_order = picks.sort_order
);

COMMIT;
