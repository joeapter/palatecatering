BEGIN;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'each';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS unit_value numeric(10,3);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS unit_label text;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS minimum_quantity numeric(10,3) NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS quantity_step numeric(10,3) NOT NULL DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS maximum_quantity numeric(10,3);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS serves_min integer;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS serves_max integer;

-- Every sellable product gets at least one normalized variant. Existing JSON
-- variants inserted by 0005 remain authoritative; this supplies the base size.
INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label, minimum_quantity, quantity_step)
SELECT p.id,
       COALESCE(NULLIF(p.sold_by, ''), 'Each'),
       COALESCE(p.sold_by, ''),
       p.price,
       CASE
         WHEN lower(COALESCE(p.sold_by, '')) ~ '(kg|gram|g$)' THEN 'weight'
         WHEN lower(COALESCE(p.sold_by, '')) ~ '(ml|litre|liter)' THEN 'volume'
         WHEN lower(COALESCE(p.sold_by, '')) ~ '(pan|tray|container|loaf|roll|side|crock)' THEN 'container'
         ELSE 'each'
       END,
       COALESCE(p.sold_by, 'Each'),
       1,
       1
FROM products p
WHERE p.active = true
  AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
ON CONFLICT (product_id, label) DO NOTHING;

CREATE INDEX IF NOT EXISTS product_variants_product_active_sort_idx ON product_variants (product_id, active, sort_order, id);

COMMIT;
