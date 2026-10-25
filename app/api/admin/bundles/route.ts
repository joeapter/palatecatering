import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Packages are sold at the full price of their contents, so the price is never
 * typed in — it is recalculated from the items every time they change. That
 * keeps a package honest when an ingredient price moves.
 */
async function recalcPrice(bundleId: number): Promise<number> {
  const { rows } = await sql`
    SELECT COALESCE(SUM(COALESCE(pv.price, p.price) * bi.quantity), 0) AS total
    FROM bundle_items bi
    JOIN products p ON p.id = bi.product_id
    LEFT JOIN product_variants pv ON pv.id = bi.variant_id
    WHERE bi.bundle_id = ${bundleId};
  `;
  const total = Number(rows[0]?.total) || 0;
  await sql`UPDATE bundles SET price = ${total}, updated_at = now() WHERE id = ${bundleId};`;
  return total;
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`
      SELECT b.id, b.name, b.slug, b.description, b.price, b.serves, b.active,
             b.sort_order, b.image_url, b.order_window_id, b.batch_limit,
             ow.name AS window_name,
             COALESCE(json_agg(json_build_object(
               'id', bi.id, 'productId', p.id, 'variantId', pv.id,
               'title', p.title, 'variantLabel', COALESCE(pv.label, p.sold_by),
               'quantity', bi.quantity, 'unitPrice', COALESCE(pv.price, p.price)
             ) ORDER BY bi.sort_order, bi.id) FILTER (WHERE bi.id IS NOT NULL), '[]') AS items
      FROM bundles b
      LEFT JOIN bundle_items bi ON bi.bundle_id = b.id
      LEFT JOIN products p ON p.id = bi.product_id
      LEFT JOIN product_variants pv ON pv.id = bi.variant_id
      LEFT JOIN order_windows ow ON ow.id = b.order_window_id
      GROUP BY b.id, ow.name
      ORDER BY b.sort_order, b.id;
    `;
    const windows = await sql`
      SELECT id, name, cutoff_at FROM order_windows
      WHERE active = true ORDER BY event_date ASC LIMIT 12;
    `;
    return NextResponse.json({ bundles: rows, windows: windows.rows });
  } catch (error) {
    console.error("Admin bundles list error", error);
    return NextResponse.json({ error: "Unable to load packages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "create") {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ error: "A package needs a name." }, { status: 400 });
      const base = slugify(name) || `package-${Date.now()}`;
      // Slug is unique; a weekly package often repeats a name, so disambiguate.
      const { rows: clash } = await sql`SELECT 1 FROM bundles WHERE slug = ${base} LIMIT 1;`;
      const slug = clash.length ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
      const { rows } = await sql`
        INSERT INTO bundles (name, slug, description, serves, price, active, needs_price_review,
                             order_window_id, batch_limit, image_url)
        VALUES (${name}, ${slug}, ${String(body.description || "")}, ${String(body.serves || "")},
                0, false, false,
                ${body.orderWindowId ? Number(body.orderWindowId) : null},
                ${body.batchLimit ? Number(body.batchLimit) : null},
                ${String(body.imageUrl || "")})
        RETURNING id;
      `;
      return NextResponse.json({ ok: true, id: rows[0].id });
    }

    if (action === "update") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await sql`
        UPDATE bundles SET
          name = COALESCE(${body.name ?? null}, name),
          description = COALESCE(${body.description ?? null}, description),
          serves = COALESCE(${body.serves ?? null}, serves),
          image_url = COALESCE(${body.imageUrl ?? null}, image_url),
          active = COALESCE(${body.active ?? null}, active),
          order_window_id = ${body.orderWindowId === undefined ? null : (body.orderWindowId ? Number(body.orderWindowId) : null)},
          batch_limit = ${body.batchLimit === undefined || body.batchLimit === "" ? null : Number(body.batchLimit)},
          updated_at = now()
        WHERE id = ${id};
      `;
      const price = await recalcPrice(id);
      return NextResponse.json({ ok: true, price });
    }

    if (action === "addItem") {
      const bundleId = Number(body.bundleId);
      const productId = Number(body.productId);
      if (!bundleId || !productId) {
        return NextResponse.json({ error: "bundleId and productId required" }, { status: 400 });
      }
      const variantId = body.variantId ? Number(body.variantId) : null;
      await sql`
        INSERT INTO bundle_items (bundle_id, product_id, variant_id, quantity, sort_order, required)
        VALUES (${bundleId}, ${productId}, ${variantId}, ${Number(body.quantity) || 1},
                COALESCE((SELECT MAX(sort_order) + 1 FROM bundle_items WHERE bundle_id = ${bundleId}), 1),
                true);
      `;
      const price = await recalcPrice(bundleId);
      return NextResponse.json({ ok: true, price });
    }

    if (action === "removeItem") {
      const itemId = Number(body.itemId);
      if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
      const { rows } = await sql`
        DELETE FROM bundle_items WHERE id = ${itemId} RETURNING bundle_id;
      `;
      if (!rows[0]) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const price = await recalcPrice(Number(rows[0].bundle_id));
      return NextResponse.json({ ok: true, price });
    }

    if (action === "setItemQuantity") {
      const itemId = Number(body.itemId);
      const quantity = Number(body.quantity);
      if (!itemId || !(quantity > 0)) {
        return NextResponse.json({ error: "itemId and a positive quantity required" }, { status: 400 });
      }
      const { rows } = await sql`
        UPDATE bundle_items SET quantity = ${quantity} WHERE id = ${itemId} RETURNING bundle_id;
      `;
      if (!rows[0]) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const price = await recalcPrice(Number(rows[0].bundle_id));
      return NextResponse.json({ ok: true, price });
    }

    if (action === "delete") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      // Kept rather than deleted when it has already been sold, so past orders
      // still resolve to a real package.
      const { rows } = await sql`
        SELECT 1 FROM orders WHERE items::text LIKE ${'%"bundleId":' + id + '%'} LIMIT 1;
      `;
      if (rows.length) {
        await sql`UPDATE bundles SET active = false, updated_at = now() WHERE id = ${id};`;
        return NextResponse.json({ ok: true, archived: true });
      }
      await sql`DELETE FROM bundles WHERE id = ${id};`;
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin bundles error", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
