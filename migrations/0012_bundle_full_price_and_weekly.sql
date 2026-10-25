BEGIN;

-- Packages are sold at the full price of their contents. The value to the
-- customer is that the menu is already decided, not that it is cheaper, and the
-- value to the kitchen is being able to batch one package for a whole week.
--
-- Because the price is now the sum of prices staff already confirmed, there is
-- nothing invented left to review, so the review flag clears and the packages
-- become sellable.
UPDATE bundles b
SET price = totals.total,
    needs_price_review = false,
    active = true,
    updated_at = now()
FROM (
  SELECT bi.bundle_id, SUM(COALESCE(pv.price, p.price) * bi.quantity) AS total
  FROM bundle_items bi
  JOIN products p ON p.id = bi.product_id
  LEFT JOIN product_variants pv ON pv.id = bi.variant_id
  GROUP BY bi.bundle_id
) AS totals
WHERE totals.bundle_id = b.id
  AND totals.total > 0;

-- Weekly packages: a bundle tied to an order window is offered only that week,
-- which is what lets the kitchen commit to producing a batch of one package.
-- NULL means the package is always on the menu.
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS order_window_id integer
  REFERENCES order_windows(id) ON DELETE SET NULL;

-- How many of this package the kitchen intends to make that week. NULL is
-- unlimited; 0 means sold out.
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS batch_limit integer;

CREATE INDEX IF NOT EXISTS bundles_window_idx ON bundles (order_window_id, active);

COMMIT;
