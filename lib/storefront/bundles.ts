import { sql } from "@vercel/postgres";

export type BundleItem = {
  productId: number;
  variantId?: number;
  title: string;
  variantLabel: string;
  quantity: number;
  image: string;
  unitPrice: number;
};

export type StorefrontBundle = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  price: number;
  serves: string;
  items: BundleItem[];
  /**
   * What the contents come to at menu prices. A package is sold at this figure —
   * the appeal is that the menu is already decided, not that it is discounted —
   * so this is kept for admin reconciliation, not to advertise a saving.
   */
  alaCarteTotal: number;
  /** Set when the package is offered for one order window only. */
  orderWindowId?: number;
};

const SELECT_BUNDLES = `
  SELECT b.id, b.name, b.slug, b.description, b.image_url, b.price, b.serves,
         b.order_window_id,
         bi.quantity, bi.sort_order AS item_sort,
         p.id AS product_id, p.title, p.image_url AS product_image,
         pv.id AS variant_id, pv.label AS variant_label,
         COALESCE(pv.price, p.price) AS unit_price
  FROM bundles b
  LEFT JOIN bundle_items bi ON bi.bundle_id = b.id
  LEFT JOIN products p ON p.id = bi.product_id AND p.active = true
  LEFT JOIN product_variants pv ON pv.id = bi.variant_id
  LEFT JOIN order_windows ow ON ow.id = b.order_window_id
  WHERE b.active = true
    -- A package with no window is always on the menu. One built for a specific
    -- week disappears once that week's ordering closes, so the kitchen is never
    -- asked to produce last week's batch.
    AND (b.order_window_id IS NULL OR (ow.active = true AND ow.cutoff_at > now()))
`;

type Row = Record<string, unknown>;

function shape(rows: Row[]): StorefrontBundle[] {
  const map = new Map<number, StorefrontBundle>();
  for (const row of rows) {
    const id = Number(row.id);
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: String(row.name),
        slug: String(row.slug),
        description: String(row.description || ""),
        image: String(row.image_url || "/assets/og-image.jpg"),
        price: Number(row.price) || 0,
        serves: String(row.serves || ""),
        items: [],
        alaCarteTotal: 0,
        orderWindowId: row.order_window_id ? Number(row.order_window_id) : undefined,
      });
    }
    // A bundle whose product was deleted still renders; the line is just dropped.
    if (row.product_id) {
      const bundle = map.get(id)!;
      const quantity = Number(row.quantity) || 1;
      const unitPrice = Number(row.unit_price) || 0;
      bundle.items.push({
        productId: Number(row.product_id),
        variantId: row.variant_id ? Number(row.variant_id) : undefined,
        title: String(row.title),
        variantLabel: String(row.variant_label || ""),
        quantity,
        image: String(row.product_image || ""),
        unitPrice,
      });
      bundle.alaCarteTotal += unitPrice * quantity;
    }
  }
  return [...map.values()];
}

export async function getBundles(): Promise<StorefrontBundle[]> {
  try {
    const { rows } = await sql.query(`${SELECT_BUNDLES} ORDER BY b.sort_order, b.id, bi.sort_order`);
    return shape(rows as Row[]);
  } catch (error) {
    console.warn("Bundles unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getBundle(slug: string): Promise<StorefrontBundle | null> {
  try {
    const { rows } = await sql.query(
      `${SELECT_BUNDLES} AND b.slug = $1 ORDER BY bi.sort_order`,
      [slug],
    );
    return shape(rows as Row[])[0] || null;
  } catch (error) {
    console.warn("Bundle lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
