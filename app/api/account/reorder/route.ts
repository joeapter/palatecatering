import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/session";
import { buildCartLines } from "@/lib/cart-lines";

/**
 * Rebuilds a cart from a past order.
 *
 * Prices are re-read from the catalog rather than copied from the old order —
 * a repeat customer should pay today's price, and an item that has since been
 * withdrawn must drop out rather than fail at checkout. Anything skipped is
 * reported back so the customer is told, not silently short-changed.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

    const orderResult = await sql`
      SELECT id, items FROM orders
      WHERE id = ${Number(orderId)}
        AND COALESCE(is_deleted, false) = false
        AND (user_id = ${user.id} OR lower(customer_email) = ${user.email.toLowerCase()})
      LIMIT 1;
    `;
    const order = orderResult.rows[0];
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const { lines, unavailable } = await buildCartLines(order.items as unknown[]);

    return NextResponse.json({ lines, unavailable });
  } catch (error) {
    console.error("Reorder error", error);
    return NextResponse.json({ error: "Unable to rebuild that order." }, { status: 500 });
  }
}
