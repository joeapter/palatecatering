import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { MENU_TAGS } from "@/lib/storefront/menus";

export const dynamic = "force-dynamic";

/**
 * Full product and variant management — the single place every price on the
 * site can be changed.
 *
 * Editing a price clears `needs_price_review` automatically: confirming what
 * something costs *is* the review. An explicit flag still wins, so an item can
 * be re-flagged without changing its price.
 */

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const menu = url.searchParams.get("menu") || "";
    const search = (url.searchParams.get("q") || "").trim();

    const { rows } = await sql`
      SELECT p.id, p.category, p.title, p.description, p.price, p.sold_by,
             p.active, p.needs_price_review, p.menu_tags, p.sort_order,
             COALESCE(json_agg(json_build_object(
               'id', v.id, 'label', v.label, 'soldBy', v.sold_by, 'price', v.price,
               'active', v.active, 'sortOrder', v.sort_order,
               'minimumQuantity', v.minimum_quantity, 'quantityStep', v.quantity_step
             ) ORDER BY v.sort_order, v.id) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE (${menu} = '' OR p.menu_tags @> ARRAY[${menu}]::text[])
        AND (${search} = '' OR p.title ILIKE ${"%" + search + "%"} OR p.category ILIKE ${"%" + search + "%"})
      GROUP BY p.id
      ORDER BY p.category, COALESCE(p.sort_order, 9999), p.title;
    `;

    const categories = await sql`
      SELECT id, name, slug, menu, sort_order, active FROM categories ORDER BY menu, sort_order, name;
    `;

    return NextResponse.json({ products: rows, categories: categories.rows, menus: MENU_TAGS });
  } catch (error) {
    console.error("Admin products error", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "updateProduct") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

      if (body.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) {
          return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
        }
        await sql`
          UPDATE products SET price = ${price}, needs_price_review = false WHERE id = ${id};
        `;
      }
      await sql`
        UPDATE products SET
          title = COALESCE(${body.title ?? null}, title),
          description = COALESCE(${body.description ?? null}, description),
          sold_by = COALESCE(${body.soldBy ?? null}, sold_by),
          category = COALESCE(${body.category ?? null}, category),
          active = COALESCE(${body.active ?? null}, active),
          needs_price_review = COALESCE(${body.needsPriceReview ?? null}, needs_price_review)
        WHERE id = ${id};
      `;
      if (Array.isArray(body.menuTags)) {
        // Arrays are not valid in the tagged-template form, so this one is
        // parameterised positionally.
        await sql.query("UPDATE products SET menu_tags = $1 WHERE id = $2", [
          body.menuTags as string[],
          id,
        ]);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "updateVariant") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "variant id required" }, { status: 400 });
      if (body.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) {
          return NextResponse.json({ error: "Enter a valid price." }, { status: 400 });
        }
      }
      await sql`
        UPDATE product_variants SET
          label = COALESCE(${body.label ?? null}, label),
          sold_by = COALESCE(${body.soldBy ?? null}, sold_by),
          price = COALESCE(${body.price === undefined ? null : Number(body.price)}, price),
          active = COALESCE(${body.active ?? null}, active),
          updated_at = now()
        WHERE id = ${id};
      `;
      // A confirmed variant price also settles the parent product.
      if (body.price !== undefined) {
        await sql`
          UPDATE products SET needs_price_review = false
          WHERE id = (SELECT product_id FROM product_variants WHERE id = ${id});
        `;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "addVariant") {
      const productId = Number(body.productId);
      const label = String(body.label || "").trim();
      const price = Number(body.price);
      if (!productId || !label || !Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { error: "A size needs a product, a label and a price above zero." },
          { status: 400 },
        );
      }
      await sql`
        INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                                      minimum_quantity, quantity_step, active, sort_order)
        VALUES (${productId}, ${label}, ${label}, ${price}, 'container', ${label}, 1, 1, true,
                COALESCE((SELECT MAX(sort_order) + 1 FROM product_variants WHERE product_id = ${productId}), 1));
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "deleteVariant") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "variant id required" }, { status: 400 });
      // Deactivated rather than deleted — past orders reference variant ids.
      await sql`UPDATE product_variants SET active = false, updated_at = now() WHERE id = ${id};`;
      return NextResponse.json({ ok: true });
    }

    if (action === "createProduct") {
      const title = String(body.title || "").trim();
      const category = String(body.category || "").trim();
      const price = Number(body.price);
      if (!title || !category || !Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { error: "A new item needs a name, a category and a price." },
          { status: 400 },
        );
      }
      const tags = Array.isArray(body.menuTags) && body.menuTags.length
        ? (body.menuTags as string[])
        : ["shabbos"];
      const { rows } = await sql.query(
        `INSERT INTO products (category, title, description, price, sold_by, qty_label,
                               image_url, menu_tags, active, needs_price_review)
         VALUES ($1, $2, $3, $4, $5, 'Order Qty', '', $6, true, false)
         RETURNING id`,
        [category, title, String(body.description || ""), price, String(body.soldBy || "Each"), tags],
      );
      const productId = rows[0].id;
      // Every product gets a variant, so the cart always references one.
      await sql`
        INSERT INTO product_variants (product_id, label, sold_by, price, unit_type, unit_label,
                                      minimum_quantity, quantity_step, active, sort_order)
        VALUES (${productId}, ${String(body.soldBy || "Each")}, ${String(body.soldBy || "Each")},
                ${price}, 'container', ${String(body.soldBy || "Each")}, 1, 1, true, 1);
      `;
      return NextResponse.json({ ok: true, id: productId });
    }

    if (action === "bulkSave") {
      // One payload of price edits from the products table. Applied in a single
      // request so a page of changes is saved together rather than row by row.
      const products = Array.isArray(body.products) ? body.products : [];
      const variants = Array.isArray(body.variants) ? body.variants : [];
      if (!products.length && !variants.length) {
        return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
      }
      if (products.length + variants.length > 500) {
        return NextResponse.json({ error: "Too many changes at once." }, { status: 400 });
      }

      for (const item of products) {
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) {
          return NextResponse.json(
            { error: `"${item.title || item.id}" has an invalid price.` },
            { status: 400 },
          );
        }
      }
      for (const item of variants) {
        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) {
          return NextResponse.json(
            { error: `"${item.label || item.id}" has an invalid price.` },
            { status: 400 },
          );
        }
      }

      for (const item of products) {
        await sql`
          UPDATE products SET price = ${Number(item.price)}, needs_price_review = false
          WHERE id = ${Number(item.id)};
        `;
      }
      for (const item of variants) {
        await sql`
          UPDATE product_variants SET price = ${Number(item.price)}, updated_at = now()
          WHERE id = ${Number(item.id)};
        `;
      }
      if (variants.length) {
        await sql.query(
          `UPDATE products SET needs_price_review = false
           WHERE id IN (SELECT product_id FROM product_variants WHERE id = ANY($1::int[]))`,
          [variants.map((v: { id: number }) => Number(v.id))],
        );
      }

      return NextResponse.json({ ok: true, saved: products.length + variants.length });
    }

    if (action === "updateCategory") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await sql`
        UPDATE categories SET
          name = COALESCE(${body.name ?? null}, name),
          description = COALESCE(${body.description ?? null}, description),
          sort_order = COALESCE(${body.sortOrder === undefined ? null : Number(body.sortOrder)}, sort_order),
          active = COALESCE(${body.active ?? null}, active),
          updated_at = now()
        WHERE id = ${id};
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin product update error", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
