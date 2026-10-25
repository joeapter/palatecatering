import { sql } from "@vercel/postgres";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("exports");
const csvPath = path.join(outputDir, "palate-complete-product-pricing.csv");
const activeCsvPath = path.join(outputDir, "palate-active-product-pricing.csv");
const markdownPath = path.join(outputDir, "palate-complete-product-pricing.md");

function csv(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseLegacyVariants(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

const { rows: products } = await sql`
  SELECT id, category, title, description, price, sold_by, qty_label,
         variants, menu_tags, active,
         COALESCE(needs_price_review, false) AS needs_price_review
  FROM products
  ORDER BY category, title, id
`;

let normalizedVariants = [];
try {
  const result = await sql`
    SELECT id, product_id, label, sold_by, price, sku, active, sort_order
    FROM product_variants
    ORDER BY product_id, sort_order, id
  `;
  normalizedVariants = result.rows;
} catch {
  // The normalized Phase 1 migration may not have been applied yet.
}

const variantsByProduct = new Map();
for (const variant of normalizedVariants) {
  const list = variantsByProduct.get(String(variant.product_id)) || [];
  list.push(variant); variantsByProduct.set(String(variant.product_id), list);
}

const rows = [];
for (const product of products) {
  const normalized = variantsByProduct.get(String(product.id)) || [];
  const legacy = parseLegacyVariants(product.variants);
  const options = normalized.length ? normalized.map((variant) => ({
    id: variant.id, label: variant.label, soldBy: variant.sold_by,
    price: variant.price, sku: variant.sku, active: variant.active,
    source: "normalized variant",
  })) : legacy.length ? legacy.map((variant) => ({
    id: "", label: variant.label || variant.soldBy || "",
    soldBy: variant.soldBy || variant.label || product.sold_by,
    price: variant.price, sku: "", active: product.active,
    source: "legacy variant",
  })) : [{ id: "", label: product.sold_by || "Base price", soldBy: product.sold_by,
    price: product.price, sku: "", active: product.active, source: "base product" }];

  for (const option of options) rows.push({
    productId: product.id, category: product.category, item: product.title,
    description: product.description || "", menuTags: (product.menu_tags || []).join(" | "),
    productActive: product.active, needsPriceReview: product.needs_price_review,
    variantId: option.id, option: option.label, soldBy: option.soldBy,
    priceIls: Number(option.price || 0).toFixed(2), optionActive: option.active,
    sku: option.sku || "", priceSource: option.source,
  });
}

const headers = ["Product ID", "Category", "Item", "Description", "Menu Tags", "Product Active", "Needs Price Review", "Variant ID", "Price Option", "Sold By", "Price (ILS)", "Option Active", "SKU", "Price Source"];
const keys = ["productId", "category", "item", "description", "menuTags", "productActive", "needsPriceReview", "variantId", "option", "soldBy", "priceIls", "optionActive", "sku", "priceSource"];
const csvOutput = [headers.map(csv).join(","), ...rows.map((row) => keys.map((key) => csv(row[key])).join(","))].join("\n") + "\n";
const comparisonRows = rows.filter((row) => row.productActive && row.optionActive && !row.needsPriceReview);
const activeCsvOutput = [headers.map(csv).join(","), ...comparisonRows.map((row) => keys.map((key) => csv(row[key])).join(","))].join("\n") + "\n";

const activeProducts = products.filter((product) => product.active).length;
const reviewProducts = products.filter((product) => product.needs_price_review).length;
const grouped = new Map();
for (const row of rows) {
  const category = row.category || "Uncategorized";
  const items = grouped.get(category) || [];
  items.push(row); grouped.set(category, items);
}
const md = [
  "# Palate complete product and pricing export",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- ${products.length} products (${activeProducts} active, ${products.length - activeProducts} inactive)` ,
  `- ${rows.length} priced rows including variations`,
  `- ${reviewProducts} products flagged for price review`,
  "- Prices are in Israeli new shekels (ILS).",
  "- Inactive and price-review items are included deliberately for completeness.",
  "",
  ...[...grouped.entries()].flatMap(([category, items]) => [
    `## ${category}`,
    "",
    "| Item | Option / sold by | Price | Status | Menus |",
    "|---|---|---:|---|---|",
    ...items.map((item) => `| ${item.item.replaceAll("|", "\\|")} | ${(item.option || item.soldBy).replaceAll("|", "\\|")} | ₪${item.priceIls} | ${item.productActive && item.optionActive ? "Active" : "Inactive"}${item.needsPriceReview ? " · Review price" : ""} | ${(item.menuTags || "—").replaceAll("|", "\\|")} |`),
    "",
  ]),
].join("\n");

await mkdir(outputDir, { recursive: true });
await Promise.all([writeFile(csvPath, csvOutput), writeFile(activeCsvPath, activeCsvOutput), writeFile(markdownPath, md)]);
console.log(JSON.stringify({ csvPath, activeCsvPath, markdownPath, products: products.length, pricedRows: rows.length, comparisonRows: comparisonRows.length, activeProducts, reviewProducts }, null, 2));
