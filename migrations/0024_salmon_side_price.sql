BEGIN;

-- Keep every whole/side-of-salmon option at the same current selling price,
-- regardless of which menu tag exposes it. Product and normalized variant
-- prices are both updated because checkout prices from the selected variant.
UPDATE products
SET price = 330, needs_price_review = false
WHERE title ILIKE '%salmon%'
  AND (title ILIKE '%side%' OR sold_by ILIKE '%side%');

UPDATE product_variants pv
SET price = 330, updated_at = now()
FROM products p
WHERE p.id = pv.product_id
  AND p.title ILIKE '%salmon%'
  AND (p.title ILIKE '%side%' OR pv.label ILIKE '%side%' OR pv.sold_by ILIKE '%side%');

COMMIT;
