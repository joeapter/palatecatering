import { sql } from "@vercel/postgres";

export type RebuiltLine = {
  key: string;
  kind: "product" | "bundle";
  productId?: number;
  variantId?: number;
  bundleId?: number;
  title: string;
  image: string;
  variantLabel: string;
  unitLabel: string;
  unitPrice: number;
  quantity: number;
  quantityStep: number;
};

/**
 * Rebuilds cart lines from stored items — used both by "order this again" and
 * by the recovery link in an abandoned-cart email.
 *
 * Prices come from the catalogue as it stands today, never from the stored
 * copy. A saved cart can be days old, and honouring a stale price would either
 * short the kitchen or surprise the customer at checkout, where the server
 * prices the order independently anyway. Anything withdrawn since is dropped
 * and named, so the customer is told rather than quietly short-changed.
 */
export async function buildCartLines(items: unknown[]) {
  const lines: RebuiltLine[] = [];
  const unavailable: string[] = [];

  for (const raw of Array.isArray(items) ? items : []) {
    const item = (raw || {}) as Record<string, unknown>;
    const quantity = Math.max(1, Number(item.quantity) || 1);

    if (item.bundleId) {
      const { rows } = await sql`
        SELECT id, name, slug, price, serves, image_url
        FROM bundles WHERE id = ${Number(item.bundleId)} AND active = true LIMIT 1;
      `;
      if (!rows[0]) { unavailable.push(String(item.title || "A package")); continue; }
      const bundle = rows[0];
      lines.push({
        key: `bundle:${bundle.id}`, kind: "bundle", bundleId: bundle.id,
        title: bundle.name, image: bundle.image_url || "",
        variantLabel: bundle.serves || "Package", unitLabel: "Package",
        unitPrice: Number(bundle.price), quantity, quantityStep: 1,
      });
      continue;
    }

    const productId = Number(item.productId);
    if (!productId) { unavailable.push(String(item.title || "An item")); continue; }
    const variantId = item.variantId ? Number(item.variantId) : null;

    const { rows } = await sql`
      SELECT p.id, p.title, p.image_url,
             pv.id AS variant_id, pv.label, pv.price AS variant_price,
             pv.unit_label, pv.quantity_step, p.price AS base_price, p.sold_by
      FROM products p
      LEFT JOIN product_variants pv
        ON pv.id = ${variantId} AND pv.product_id = p.id AND pv.active = true
      WHERE p.id = ${productId} AND p.active = true
      LIMIT 1;
    `;
    const row = rows[0];
    if (!row) { unavailable.push(String(item.title || "An item")); continue; }

    const unitPrice = Number(row.variant_price ?? row.base_price) || 0;
    if (unitPrice <= 0) { unavailable.push(String(row.title)); continue; }

    lines.push({
      key: `${row.id}:${row.variant_id ?? row.sold_by ?? "base"}`,
      kind: "product",
      productId: row.id,
      variantId: row.variant_id || undefined,
      title: row.title,
      image: row.image_url || "",
      variantLabel: row.label || row.sold_by || "Each",
      unitLabel: row.unit_label || row.sold_by || "Each",
      unitPrice,
      quantity,
      quantityStep: Number(row.quantity_step) || 1,
    });
  }

  return { lines, unavailable };
}
