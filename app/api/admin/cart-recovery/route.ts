import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * What the reminder sequence is doing and what it is worth.
 *
 * The recovered figure is deliberately attributed only to carts that actually
 * received a reminder before they were paid for. Counting every recovered cart
 * would flatter the emails with orders that would have happened anyway.
 */
export const dynamic = "force-dynamic";

/** The id shape the storefront generates, and the only thing worth a lookup. */
const CART_ID = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * One basket, in full, including what is in it.
 *
 * The list below carries no items on purpose — a hundred baskets of thirteen
 * dishes each is a payload nobody reads — so opening one fetches it alone.
 */
async function oneCart(id: string) {
  if (!CART_ID.test(id)) return NextResponse.json({ error: "Unknown basket." }, { status: 400 });

  const { rows } = await sql`
    SELECT ac.id, ac.status, ac.customer_name, ac.customer_email, ac.customer_phone,
           ac.customer_address, ac.delivery_type, ac.total, ac.item_count, ac.items,
           ac.notes, ac.allergies, ac.order_id, ac.order_window_id, ac.shabbos_label,
           ac.last_seen_at, ac.page_url,
           ow.name AS window_name, ow.cutoff_at, ow.cutoff_at > now() AS window_open,
           o.order_number AS converted_order_number
    FROM abandoned_carts ac
    LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
    LEFT JOIN orders o ON o.id = ac.order_id AND COALESCE(o.is_deleted, false) = false
    WHERE ac.id = ${id}
    LIMIT 1;
  `;
  const cart = rows[0];
  if (!cart) return NextResponse.json({ error: "Basket not found." }, { status: 404 });
  return NextResponse.json({ cart });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requestedCart = new URL(request.url).searchParams.get("cart");
  if (requestedCart) {
    try {
      return await oneCart(requestedCart);
    } catch (error) {
      console.error("Basket lookup failed", error);
      return NextResponse.json({ error: "Unable to open that basket." }, { status: 500 });
    }
  }

  try {
    const [live, totals, byStage, recent] = await Promise.all([
      sql`
        SELECT ac.id, ac.status, ac.customer_name, ac.customer_email, ac.total, ac.item_count,
               ac.reminders_sent, ac.last_reminder_stage, ac.last_reminder_at, ac.last_seen_at,
               ac.reminder_stop_reason, ac.unsubscribed_at, ac.recovery_token, ac.order_id,
               ow.name AS window_name, ow.cutoff_at,
               o.order_number AS converted_order_number
        FROM abandoned_carts ac
        LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
        LEFT JOIN orders o ON o.id = ac.order_id AND COALESCE(o.is_deleted, false) = false
        WHERE ac.item_count > 0
          AND ac.last_seen_at > now() - interval '45 days'
        ORDER BY ac.last_seen_at DESC
        LIMIT 100;
      `,
      sql`
        SELECT
          count(*) FILTER (WHERE status IN ('open','checkout_started'))::int AS live_carts,
          COALESCE(sum(NULLIF(total,'')::numeric) FILTER (WHERE status IN ('open','checkout_started')), 0) AS live_value,
          count(*) FILTER (WHERE status IN ('ordered','recovered'))::int AS recovered_carts
        FROM abandoned_carts
        WHERE item_count > 0 AND last_seen_at > now() - interval '45 days';
      `,
      sql`
        SELECT stage,
               count(*) FILTER (WHERE ok)::int AS sent,
               count(*) FILTER (WHERE ok AND recovered_at IS NOT NULL)::int AS recovered,
               count(*) FILTER (WHERE NOT ok)::int AS failed
        FROM cart_reminder_log
        WHERE sent_at > now() - interval '45 days'
        GROUP BY stage;
      `,
      // Money actually attributable to a reminder: the cart was mailed, then paid.
      sql`
        SELECT COALESCE(sum(NULLIF(ac.total,'')::numeric), 0) AS recovered_value,
               count(DISTINCT ac.id)::int AS recovered_count
        FROM abandoned_carts ac
        WHERE ac.status IN ('ordered','recovered')
          AND ac.last_seen_at > now() - interval '45 days'
          AND EXISTS (
            SELECT 1 FROM cart_reminder_log l
            WHERE l.cart_id = ac.id AND l.ok = true AND l.recovered_at IS NOT NULL
          );
      `,
    ]);

    return NextResponse.json({
      carts: live.rows,
      totals: totals.rows[0] || {},
      byStage: byStage.rows,
      attributed: recent.rows[0] || {},
    });
  } catch (error) {
    console.error("Cart recovery report failed", error);
    return NextResponse.json({ error: "Unable to load cart recovery." }, { status: 500 });
  }
}
