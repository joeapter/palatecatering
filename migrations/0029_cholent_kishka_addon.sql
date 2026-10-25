BEGIN;

-- An add-on is modelled as its own variant rather than a flag on the order
-- line. Checkout already prices from the variant, and every order form, kitchen
-- sheet and cook list already prints the variant's sold_by — so "Kishka added"
-- reaches all of them with nothing downstream having to learn a new concept.
--
-- `addon_of` is what lets the product card show it as a checkbox on the base
-- size instead of a second size in the dropdown.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS addon_of integer REFERENCES product_variants(id),
  ADD COLUMN IF NOT EXISTS addon_label text;

-- Kishka, +₪80, on every size of every cholent.
INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_value, unit_label,
                              minimum_quantity, quantity_step, maximum_quantity,
                              serves_min, serves_max, active, sort_order, addon_of, addon_label)
SELECT pv.product_id,
       pv.label || ' · Kishka added',
       COALESCE(NULLIF(pv.sold_by, ''), pv.label) || ' · Kishka added',
       pv.price + 80, pv.unit_type, pv.unit_value, pv.unit_label || ' · Kishka added',
       pv.minimum_quantity, pv.quantity_step, pv.maximum_quantity,
       pv.serves_min, pv.serves_max, true, pv.sort_order, pv.id, 'Kishka'
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE (p.title ILIKE '%cholent%' OR p.title ILIKE '%chulent%')
  AND pv.active = true
  AND pv.addon_of IS NULL
  AND NOT EXISTS (SELECT 1 FROM product_variants a WHERE a.addon_of = pv.id AND a.addon_label = 'Kishka');

COMMIT;
