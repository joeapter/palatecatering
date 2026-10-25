import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Flat product + variant list for admin pickers. Unlike the storefront catalog
 * this returns real product_variants ids (needed to build a package line) and
 * includes inactive items, so staff can see everything they have.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`
      SELECT p.id, p.title, p.category, p.price, p.sold_by, p.active,
             p.needs_price_review,
             COALESCE(json_agg(json_build_object(
               'id', pv.id, 'label', pv.label, 'price', pv.price
             ) ORDER BY pv.sort_order, pv.id) FILTER (WHERE pv.id IS NOT NULL), '[]') AS variants
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
      GROUP BY p.id
      ORDER BY p.category, p.title;
    `;
    return NextResponse.json({ products: rows });
  } catch (error) {
    console.error("Admin catalog error", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}
