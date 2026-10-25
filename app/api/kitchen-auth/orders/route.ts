import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isKitchenRequest } from "@/lib/kitchen-session";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * The kitchen screen's data and its two write actions.
 *
 * Scope is deliberately narrow: read orders that still need making, and move
 * one along. There is no pricing, no deletion, no customer list — the kitchen
 * tablet is a shared device and should not be able to do damage that cannot be
 * seen from the order board.
 */
export const dynamic = "force-dynamic";

const KITCHEN_STATUSES = new Set(["new", "in_progress", "ready", "out_for_delivery", "delivered"]);

function allowed(request: Request) {
  return isKitchenRequest(request) || isAdminRequest(request);
}

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "active";

  try {
    // 'active' is what the kitchen wants nearly always: everything not yet out
    // of the building. 'all' widens to the last few days for a look back.
    const rows = scope === "all"
      ? await sql`
          SELECT id, order_number, customer_name, customer_phone, customer_address,
                 shabbos_label, allergies, total, items, status, created_at
          FROM orders
          WHERE COALESCE(is_deleted,false) = false
            AND created_at > now() - interval '10 days'
          ORDER BY created_at DESC LIMIT 200;`
      : await sql`
          SELECT id, order_number, customer_name, customer_phone, customer_address,
                 shabbos_label, allergies, total, items, status, created_at
          FROM orders
          WHERE COALESCE(is_deleted,false) = false
            AND status IN ('new', 'in_progress', 'ready', 'out_for_delivery')
          ORDER BY
            CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END,
            created_at ASC
          LIMIT 200;`;

    return NextResponse.json({ orders: rows.rows });
  } catch (error) {
    console.error("Kitchen orders load failed", error);
    return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, status } = await request.json();
    const orderId = Number(id);
    const next = String(status || "");

    if (!orderId || !KITCHEN_STATUSES.has(next)) {
      return NextResponse.json({ error: "Unknown order or status." }, { status: 400 });
    }

    const result = await sql`
      UPDATE orders SET status = ${next}
      WHERE id = ${orderId} AND COALESCE(is_deleted,false) = false
      RETURNING id, status;
    `;
    if (result.rowCount === 0) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    return NextResponse.json({ ok: true, status: result.rows[0].status });
  } catch (error) {
    console.error("Kitchen status update failed", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
