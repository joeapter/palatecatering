import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { buildCartLines } from "@/lib/cart-lines";

/**
 * Turns a recovery token from a reminder email back into a cart.
 *
 * The token stands in for a login — someone clicking a link in their own inbox
 * has proved enough to get their own basket back, and demanding a password
 * here would defeat the point of the email. It grants nothing else: it returns
 * cart contents only, never order history, an address, or a saved card.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const clean = String(token || "").trim();
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(clean)) {
      return NextResponse.json({ error: "That link is not valid." }, { status: 400 });
    }

    const { rows } = await sql`
      SELECT ac.id, ac.items, ac.status, ac.order_window_id, ac.delivery_type,
             ow.name AS window_name, ow.cutoff_at
      FROM abandoned_carts ac
      LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
      WHERE ac.recovery_token = ${clean}
      LIMIT 1;
    `;
    const cart = rows[0];
    if (!cart) return NextResponse.json({ error: "That link has expired." }, { status: 404 });

    if (cart.status === "ordered" || cart.status === "recovered") {
      return NextResponse.json({ error: "That order has already been placed." }, { status: 409 });
    }

    // The window may have closed between the email going out and the click.
    // Rebuilding the cart is still right — they can move it to the next date —
    // but saying so beats a silent failure at checkout.
    const cutoffPassed = cart.cutoff_at ? new Date(cart.cutoff_at).getTime() <= Date.now() : false;

    const { lines, unavailable } = await buildCartLines(cart.items as unknown[]);
    if (!lines.length) {
      return NextResponse.json({ error: "Nothing in that basket is still available." }, { status: 410 });
    }

    return NextResponse.json({
      lines,
      unavailable,
      cutoffPassed,
      windowName: cart.window_name || null,
      orderWindowId: cart.order_window_id || null,
    });
  } catch (error) {
    console.error("Cart restore failed", error);
    return NextResponse.json({ error: "That basket could not be restored." }, { status: 500 });
  }
}
