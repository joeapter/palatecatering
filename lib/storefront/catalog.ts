import { sql } from "@vercel/postgres";
import fallbackMenu from "@/data/shabbos-menu.json";
import type { ProductVariant, StorefrontCategory, StorefrontProduct } from "./types";

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const categoryCopy: Record<string, string> = {
  salatim: "Bright dips and salads to begin the table.", fish: "Classic fish and salmon for the first course.",
  soups: "Slow-simmered comfort, ready to warm.", chicken: "Generous mains, roasted and glazed.",
  meat: "Slow-cooked centrepieces for the Shabbos table.", sides: "Kugels, grains and vegetables for every plate.",
  salads: "Abundant composed salads for a crowd.", appetizers: "Small bites with a celebratory feel.",
};

function fallbackCatalog(): StorefrontCategory[] {
  return fallbackMenu.map((category, categoryIndex) => {
    const categorySlug = slugify(category.category);
    const products: StorefrontProduct[] = category.items.map((item, itemIndex) => ({
      id: `fallback-${categoryIndex}-${itemIndex}`, category: category.category, categorySlug,
      title: item.title, slug: slugify(item.title), description: item.description || "",
      price: Number(item.price) || 0, soldBy: item.soldBy || "", image: item.image || "",
      variants: [{ label: item.soldBy || "Each", price: Number(item.price) || 0, soldBy: item.soldBy || "Each", unitType: "each", unitLabel: item.soldBy || "Each", minimumQuantity: 1, quantityStep: 1 }],
    }));
    return { name: category.category, slug: categorySlug, description: categoryCopy[categorySlug] || "Prepared for your Shabbos table.", image: products.find((item) => item.image)?.image || "/assets/og-image.jpg", products };
  });
}

function variantsFrom(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  return value.map((variant) => {
    const item = variant as Record<string, unknown>;
    const unitType = ["each", "weight", "volume", "container"].includes(String(item.unitType || item.unit_type)) ? String(item.unitType || item.unit_type) as ProductVariant["unitType"] : "each";
    return { id: item.id ? Number(item.id) : undefined, label: String(item.label || item.soldBy || ""), price: Number(item.price) || 0, soldBy: String(item.soldBy || item.sold_by || item.label || ""), unitType, unitValue: item.unitValue || item.unit_value ? Number(item.unitValue || item.unit_value) : undefined, unitLabel: String(item.unitLabel || item.unit_label || item.soldBy || item.sold_by || item.label || ""), minimumQuantity: Number(item.minimumQuantity || item.minimum_quantity) || 1, quantityStep: Number(item.quantityStep || item.quantity_step) || 1, maximumQuantity: item.maximumQuantity || item.maximum_quantity ? Number(item.maximumQuantity || item.maximum_quantity) : undefined, servesMin: item.servesMin || item.serves_min ? Number(item.servesMin || item.serves_min) : undefined, servesMax: item.servesMax || item.serves_max ? Number(item.servesMax || item.serves_max) : undefined, addonOf: item.addonOf || item.addon_of ? Number(item.addonOf || item.addon_of) : undefined, addonLabel: item.addonLabel || item.addon_label ? String(item.addonLabel || item.addon_label) : undefined };
  }).filter((variant) => variant.label && variant.price > 0);
}

export async function getShabbosCatalog(): Promise<StorefrontCategory[]> {
  try {
    const { rows } = await sql`
      SELECT p.id, p.category, p.title, p.description, p.price, p.sold_by, p.image_url,
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object(
                 'id', pv.id, 'label', pv.label, 'price', pv.price,
                 'sold_by', pv.sold_by, 'unit_type', pv.unit_type,
                 'unit_value', pv.unit_value, 'unit_label', pv.unit_label,
                 'minimum_quantity', pv.minimum_quantity,
                 'quantity_step', pv.quantity_step,
                 'maximum_quantity', pv.maximum_quantity,
                 'serves_min', pv.serves_min, 'serves_max', pv.serves_max,
                 'addon_of', pv.addon_of, 'addon_label', pv.addon_label
               ) ORDER BY pv.sort_order, pv.id)
               FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true),
               NULLIF(p.variants, '[]'::jsonb),
               jsonb_build_array(jsonb_build_object('label', COALESCE(NULLIF(p.sold_by, ''), 'Each'), 'soldBy', p.sold_by, 'price', p.price))
             ) AS variants,
             p.slug AS product_slug, p.badge, p.serves,
             c.id AS category_id, c.slug AS category_slug, c.description AS category_description,
             c.hero_image_url
      FROM products p
      LEFT JOIN categories c ON c.name = p.category AND c.menu = 'shabbos'
      WHERE p.active = true
        AND COALESCE(p.needs_price_review, false) = false
        AND (p.menu_tags @> ARRAY['shabbos']::text[] OR p.menu_tags IS NULL)
      ORDER BY COALESCE(c.sort_order, 999), p.category, COALESCE(p.sort_order, p.id), p.id;
    `;
    if (!rows.length) return fallbackCatalog();
    const map = new Map<string, StorefrontCategory>();
    for (const row of rows) {
      const categorySlug = row.category_slug || slugify(row.category);
      if (!map.has(categorySlug)) map.set(categorySlug, { id: row.category_id, name: row.category, slug: categorySlug, description: row.category_description || categoryCopy[categorySlug] || "Prepared for your Shabbos table.", image: row.hero_image_url || row.image_url || "/assets/og-image.jpg", products: [] });
      map.get(categorySlug)!.products.push({ id: row.id, category: row.category, categorySlug, title: row.title, slug: row.product_slug || slugify(row.title), description: row.description || "", price: Number(row.price) || 0, soldBy: row.sold_by || "", image: row.image_url || "", badge: row.badge || undefined, serves: row.serves || undefined, variants: variantsFrom(row.variants) });
    }
    return [...map.values()];
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Using local catalog fallback:", error instanceof Error ? error.message : error);
    return fallbackCatalog();
  }
}

export async function getCategory(slug: string) { return (await getShabbosCatalog()).find((category) => category.slug === slug) || null; }

const dairyCategoryCopy: Record<string, string> = {
  appetizers: "Small savoury bites for a dairy table or event.",
  bakery: "Bagels, muffins and freshly baked additions.",
  breakfast: "Easy breakfast favourites, ready to serve.",
  "breakfast-stations": "Generous breakfast stations for groups and events.",
  "combination-platters": "Balanced platters assembled for effortless hosting.",
  desserts: "A sweet finish for dairy meals and celebrations.",
  dips: "House-made dips and spreads for the table.",
  fish: "Prepared fish dishes for lunches, buffets and events.",
  "hot-foods": "Warm dairy dishes, prepared and ready to serve.",
  pasta: "Comforting pasta dishes in a range of sauces and sizes.",
  platters: "Ready-to-serve dairy platters for meetings and simchas.",
  salads: "Fresh composed salads for the table or buffet.",
  "sandwich-platters": "Sandwich assortments made for sharing.",
  soups: "Fresh soups for a complete dairy meal.",
  "spreads-salads": "Fresh spreads and salads for breakfast or lunch.",
};

/** The dairy storefront reads the same products, variants and images managed
 * by the new Product Admin; it does not depend on the legacy dairy.html menu. */
export async function getDairyCatalog(): Promise<StorefrontCategory[]> {
  const { rows } = await sql`
    SELECT p.id, p.category, p.title, p.description, p.price, p.sold_by, p.image_url,
           COALESCE(
             (SELECT jsonb_agg(jsonb_build_object(
               'id', pv.id, 'label', pv.label, 'price', pv.price,
               'sold_by', pv.sold_by, 'unit_type', pv.unit_type,
               'unit_value', pv.unit_value, 'unit_label', pv.unit_label,
               'minimum_quantity', pv.minimum_quantity,
               'quantity_step', pv.quantity_step,
               'maximum_quantity', pv.maximum_quantity,
               'serves_min', pv.serves_min, 'serves_max', pv.serves_max,
               'addon_of', pv.addon_of, 'addon_label', pv.addon_label
             ) ORDER BY pv.sort_order, pv.id)
             FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true),
             NULLIF(p.variants, '[]'::jsonb),
             jsonb_build_array(jsonb_build_object('label', COALESCE(NULLIF(p.sold_by, ''), 'Each'), 'soldBy', p.sold_by, 'price', p.price))
           ) AS variants,
           p.slug AS product_slug, p.badge, p.serves
    FROM products p
    WHERE p.active = true
      AND COALESCE(p.needs_price_review, false) = false
      AND p.menu_tags @> ARRAY['dairy']::text[]
    ORDER BY p.category, COALESCE(p.sort_order, p.id), p.id;
  `;
  const map = new Map<string, StorefrontCategory>();
  for (const row of rows) {
    const categorySlug = slugify(row.category);
    if (!map.has(categorySlug)) {
      map.set(categorySlug, {
        name: row.category,
        slug: categorySlug,
        description: dairyCategoryCopy[categorySlug] || "Prepared for your dairy table.",
        image: row.image_url || "/assets/og-image.jpg",
        products: [],
      });
    }
    const category = map.get(categorySlug)!;
    if (category.image === "/assets/og-image.jpg" && row.image_url) category.image = row.image_url;
    category.products.push({
      id: row.id, category: row.category, categorySlug, title: row.title,
      slug: row.product_slug || slugify(row.title), description: row.description || "",
      price: Number(row.price) || 0, soldBy: row.sold_by || "", image: row.image_url || "",
      badge: row.badge || undefined, serves: row.serves || undefined,
      variants: variantsFrom(row.variants),
    });
  }
  return [...map.values()];
}
