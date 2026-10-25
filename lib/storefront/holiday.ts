import { sql } from "@vercel/postgres";
import { slugify } from "./catalog";
import type { StorefrontCategory, StorefrontProduct } from "./types";

/**
 * Catalog for a seasonal menu, selected by menu tag (e.g. "rosh-hashanah").
 *
 * Mirrors the Shabbos catalog's rules: only active products, and nothing whose
 * price is still awaiting review, so an unconfirmed price can never reach a
 * customer.
 */
export async function getHolidayMenu(tag: string): Promise<StorefrontCategory[]> {
  try {
    const { rows } = await sql`
      SELECT p.id, p.category, p.title, p.description, p.price, p.sold_by, p.image_url,
             p.slug AS product_slug, p.badge, p.serves,
             c.slug AS category_slug, c.description AS category_description, c.hero_image_url,
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object(
                 'id', pv.id, 'label', pv.label, 'price', pv.price,
                 'sold_by', pv.sold_by, 'unit_type', pv.unit_type,
                 'unit_label', pv.unit_label,
                 'minimum_quantity', pv.minimum_quantity,
                 'quantity_step', pv.quantity_step
               ) ORDER BY pv.sort_order, pv.id)
                FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true),
               jsonb_build_array(jsonb_build_object(
                 'label', COALESCE(NULLIF(p.sold_by, ''), 'Each'),
                 'soldBy', p.sold_by, 'price', p.price))
             ) AS variants
      FROM products p
      LEFT JOIN categories c ON c.name = p.category
      WHERE p.active = true
        AND COALESCE(p.needs_price_review, false) = false
        AND p.menu_tags @> ARRAY[${tag}]::text[]
      ORDER BY COALESCE(c.sort_order, 999), p.category, p.id;
    `;

    const map = new Map<string, StorefrontCategory>();
    for (const row of rows) {
      const categorySlug = row.category_slug || slugify(row.category);
      if (!map.has(categorySlug)) {
        map.set(categorySlug, {
          name: row.category,
          slug: categorySlug,
          description: row.category_description || "",
          image: row.hero_image_url || row.image_url || "/assets/og-image.jpg",
          products: [],
        });
      }
      const variants = Array.isArray(row.variants) ? row.variants : [];
      const product: StorefrontProduct = {
        id: row.id,
        category: row.category,
        categorySlug,
        title: row.title,
        slug: row.product_slug || slugify(row.title),
        description: row.description || "",
        price: Number(row.price) || 0,
        soldBy: row.sold_by || "",
        image: row.image_url || "",
        badge: row.badge || undefined,
        serves: row.serves || undefined,
        variants: variants.map((raw: Record<string, unknown>) => ({
          id: raw.id ? Number(raw.id) : undefined,
          label: String(raw.label || raw.soldBy || "Each"),
          price: Number(raw.price) || 0,
          soldBy: String(raw.sold_by || raw.soldBy || raw.label || ""),
          unitType: "each" as const,
          unitLabel: String(raw.unit_label || raw.sold_by || raw.label || "Each"),
          minimumQuantity: Number(raw.minimum_quantity) || 1,
          quantityStep: Number(raw.quantity_step) || 1,
        })),
      };
      map.get(categorySlug)!.products.push(product);
    }
    return [...map.values()];
  } catch (error) {
    console.warn(`Holiday menu "${tag}" unavailable:`, error instanceof Error ? error.message : error);
    return [];
  }
}
