import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The price-review queue: anything whose price was generated rather than set by
 * staff. Those rows are seeded inactive, so nothing with an unconfirmed price
 * can ever be sold — confirming the price here is what puts it on the menu.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`
      SELECT id, category, title, description, price, sold_by, active, image_url
      FROM products
      WHERE needs_price_review = true
      ORDER BY category, title;
    `;
    return NextResponse.json({ products: rows });
  } catch (error) {
    console.error("Pricing queue error", error);
    return NextResponse.json({ error: "Unable to load the review queue." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (body.action === "reject") {
      // Not something Palate sells — take it off the menu and out of the queue.
      await sql`UPDATE products SET active = false, needs_price_review = false WHERE id = ${id};`;
      return NextResponse.json({ ok: true });
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Enter a price above zero." }, { status: 400 });
    }
    const soldBy = body.soldBy === undefined ? null : String(body.soldBy);

    // Confirming the price clears the flag and puts the item on sale.
    await sql`
      UPDATE products
      SET price = ${price},
          sold_by = COALESCE(${soldBy}, sold_by),
          needs_price_review = false,
          active = true
      WHERE id = ${id};
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pricing update error", error);
    return NextResponse.json({ error: "That price could not be saved." }, { status: 500 });
  }
}
