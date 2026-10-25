BEGIN;

-- Replaces the entire Rosh Hashanah menu with the printed 2026 holiday takeout
-- menu. Every item, description, size and price below is transcribed from that
-- menu — nothing is carried over from the earlier placeholder version.
--
-- Products created here are marked with a slug prefixed `rh26-`, which is what
-- makes this migration idempotent and lets the purge below tell the new menu
-- apart from the Shabbos products that were previously mis-tagged.

-- 1. Untag everything that is not part of this menu. The earlier version tagged
--    ~60 Shabbos products as Rosh Hashanah; they belong on the Shabbos menu only.
UPDATE products
SET menu_tags = array_remove(menu_tags, 'rosh-hashanah')
WHERE menu_tags @> ARRAY['rosh-hashanah']::text[]
  AND COALESCE(slug, '') NOT LIKE 'rh26-%';

-- 2. Retire the earlier placeholder items (Round Challah, Simanim Platter, etc.).
--    Deactivated rather than deleted so any order referencing them still resolves.
UPDATE products
SET active = false, needs_price_review = false,
    menu_tags = array_remove(COALESCE(menu_tags, ARRAY[]::text[]), 'rosh-hashanah')
WHERE category = 'Rosh Hashanah Specials';

-- 3. The menu itself.
CREATE TEMP TABLE rh_menu (
  sort_order   integer,
  category     text,
  title        text,
  description  text,
  sold_by      text,
  price        numeric,      -- base / smaller size
  full_label   text,         -- NULL when the item has a single size
  full_sold_by text,
  full_price   numeric,
  serves_min   integer,
  serves_max   integer
) ON COMMIT DROP;

INSERT INTO rh_menu VALUES
  -- SALATIM · 500g · 50 NIS
  (10,'Salatim','Confit of Garlic','','500g',50,NULL,NULL,NULL,NULL,NULL),
  (11,'Salatim','Roasted Eggplant & Pomegranate','','500g',50,NULL,NULL,NULL,NULL,NULL),
  (12,'Salatim','Apple Fennel Crunch','','500g',50,NULL,NULL,NULL,NULL,NULL),
  (13,'Salatim','Roasted Beet & Citrus Salad','','500g',50,NULL,NULL,NULL,NULL,NULL),
  (14,'Salatim','Roasted Carrot & Tahini','','500g',50,NULL,NULL,NULL,NULL,NULL),
  (15,'Salatim','Charred Cabbage Slaw','','500g',50,NULL,NULL,NULL,NULL,NULL),

  -- SOUPS · 1-litre containers
  (20,'Soups','Classic Chicken Soup','','1 Litre',55,NULL,NULL,NULL,NULL,NULL),
  (21,'Soups','Meat Soup','','1 Litre',70,NULL,NULL,NULL,NULL,NULL),
  (22,'Soups','Butternut Squash Soup','','1 Litre',50,NULL,NULL,NULL,NULL,NULL),

  -- FISH · sold by side of salmon
  (30,'Fish','Pomegranate Teriyaki Salmon','','Side of Salmon',320,NULL,NULL,NULL,NULL,NULL),
  (31,'Fish','Citrus Silan Salmon','','Side of Salmon',320,NULL,NULL,NULL,NULL,NULL),
  (32,'Fish','Hickory Maple Salmon','','Side of Salmon',320,NULL,NULL,NULL,NULL,NULL),
  (33,'Fish','Mediterranean Roasted Salmon','','Side of Salmon',330,NULL,NULL,NULL,NULL,NULL),

  -- MEAT · half pan serves 4–6 · full pan serves 10–12
  (40,'Meat','Silan Spiced Assado','Slow-braised beef rubbed with North African spices, glazed with silan & finished with a rich savory jus','Half Pan',325,'Full Pan','Full Pan',425,4,6),
  (41,'Meat','Korean BBQ Short Ribs','Tender short ribs glazed with a sweet & savory Korean-style BBQ sauce','Half Pan',325,'Full Pan','Full Pan',425,4,6),
  (42,'Meat','French Onion Brisket','Slow-braised brisket with deeply caramelized onions & rich onion gravy','Half Pan',310,'Full Pan','Full Pan',410,4,6),
  (43,'Meat','Honey Mustard Corned Beef','Tender corned beef glazed with honey, mustard & warm spices','Half Pan',310,'Full Pan','Full Pan',410,4,6),
  (44,'Meat','Sweet & Sour Pomegranate Meatballs','Tender beef meatballs in a sweet & tangy pomegranate-silan sauce','Half Pan',190,'Full Pan','Full Pan',250,4,6),

  -- CHICKEN · 1.5kg · serves 6–8
  (50,'Chicken','Chicken Marbella','Roasted chicken with olives, capers, dates & a sweet-savory herb sauce','1.5 Kg',260,NULL,NULL,NULL,6,8),
  (51,'Chicken','Smoky Buffalo Poppers','Crispy chicken bites in a smoky buffalo glaze','1.5 Kg',240,NULL,NULL,NULL,6,8),
  (52,'Chicken','Pomegranate Sumac Chicken','Roasted chicken glazed with pomegranate, sumac & silan','1.5 Kg',260,NULL,NULL,NULL,6,8),
  (53,'Chicken','Onion, Herb & Date Spatchcock Chicken','Whole roasted chicken with caramelized onions, dates & fresh herbs','Whole Chicken',175,NULL,NULL,NULL,NULL,NULL),
  (54,'Chicken','Apricot Harissa Pargiot','Boneless chicken thighs in a sweet, smoky apricot-harissa glaze','1.5 Kg',395,NULL,NULL,NULL,6,8),
  (55,'Chicken','Honey Garlic Chicken Poppers','Crispy chicken bites tossed in a sticky honey-garlic glaze','1.5 Kg',350,NULL,NULL,NULL,6,8),

  -- SIDES · 9x13 tray · half serves 4–6 · full serves 10–12
  (60,'Sides','Jeweled Couscous','Pearl couscous with roasted vegetables, toasted almonds, herbs & dried cranberries','Half Pan',80,'Full Pan','Full Pan',130,4,6),
  (61,'Sides','Maple Herb Roasted Root Vegetables','Seasonal root vegetables roasted with maple & fresh herbs','Half Pan',80,'Full Pan','Full Pan',130,4,6),
  (62,'Sides','Curry Roasted Cauliflower','Roasted cauliflower with warm curry spices, garlic & fresh herbs','Half Pan',95,'Full Pan','Full Pan',160,4,6),
  (63,'Sides','Herb Potato Gratin','Thinly sliced potatoes baked with garlic & fresh herbs','Half Pan',80,'Full Pan','Full Pan',130,4,6),
  (64,'Sides','Roasted Squash','Roasted seasonal squash with sage, crispy shallots & a touch of maple','Half Pan',80,'Full Pan','Full Pan',130,4,6),
  (65,'Sides','Caramelized Onion Green Beans','Green beans tossed with deeply caramelized onions, garlic & toasted almonds','Half Pan',80,'Full Pan','Full Pan',130,4,6),

  -- KUGELS & SAVORIES · 9x13 tray
  (70,'Kugels & Savories','Butternut Squash Kugel','Roasted butternut squash with warm spices & maple','Half Pan',75,'Full Pan','Full Pan',125,4,6),
  (71,'Kugels & Savories','Carrot Muffins','Individual carrot kugel muffins with cinnamon & a touch of honey','12 Pcs',75,'24 Pcs','24 Pcs',125,NULL,NULL),
  (72,'Kugels & Savories','Fried Mushroom Potato Kugel','Classic potato kugel with savory fried mushrooms & caramelized onions','Half Pan',80,'Full Pan','Full Pan',135,4,6);

-- 4. Create the products. Priced from the printed menu, so nothing needs review.
INSERT INTO products (category, title, description, price, sold_by, qty_label,
                      image_url, menu_tags, active, needs_price_review, slug, sort_order, serves)
SELECT m.category, m.title, m.description, m.price, m.sold_by, 'Order Qty',
       '', ARRAY['rosh-hashanah']::text[], true, false,
       'rh26-' || lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g')),
       m.sort_order,
       CASE WHEN m.serves_min IS NOT NULL
            THEN 'Serves ' || m.serves_min || '–' || m.serves_max END
FROM rh_menu m
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.slug = 'rh26-' || lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g'))
);

-- 5. Sizes. Every item gets its base size as a variant so the cart always
--    references a variant, and two-size items get the larger one as well.
INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                              minimum_quantity, quantity_step, serves_min, serves_max,
                              active, sort_order)
SELECT p.id, m.sold_by, m.sold_by, m.price, 'container', m.sold_by, 1, 1,
       m.serves_min, m.serves_max, true, 1
FROM rh_menu m
JOIN products p ON p.slug = 'rh26-' || lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.label = m.sold_by
);

INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                              minimum_quantity, quantity_step, serves_min, serves_max,
                              active, sort_order)
SELECT p.id, m.full_label, m.full_sold_by, m.full_price, 'container', m.full_label, 1, 1,
       CASE WHEN m.serves_min IS NOT NULL THEN 10 END,
       CASE WHEN m.serves_min IS NOT NULL THEN 12 END,
       true, 2
FROM rh_menu m
JOIN products p ON p.slug = 'rh26-' || lower(regexp_replace(m.title, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE m.full_label IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.label = m.full_label
  );

COMMIT;
