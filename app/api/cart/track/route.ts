import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/session";

/**
 * Records a cart in progress so it can be recovered if it is never paid for.
 *
 * The old HTML shop had this and the new storefront did not, which meant cart
 * recovery would have dropped to zero the moment the new site became the only
 * shop. This writes into the same `abandoned_carts` table the old pages use, so
 * one admin list covers both during the cutover rather than two half-lists.
 *
 * A cart with no email address is still worth recording — it shows up in the
 * admin and counts toward how much is being lost — but only one with an email
 * can be mailed.
 */
export const dynamic = "force-dynamic";

type Line = { title?: string; quantity?: number; unitPrice?: number; variantLabel?: string };

function clean(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Client-generated id, kept in localStorage. Constrained so it cannot be
    // used to smuggle anything into the row.
    const cartId = clean(body.cartId, 64);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(cartId)) {
      return NextResponse.json({ error: "Invalid cart id." }, { status: 400 });
    }

    const items: Line[] = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    const itemCount = items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

    // An emptied cart is not an abandoned one; recording it as open would mail
    // people about a cart with nothing in it.
    if (!items.length) {
      await sql`
        UPDATE abandoned_carts
        SET status = 'emptied', item_count = 0, updated_at = now(), last_seen_at = now()
        WHERE id = ${cartId} AND status IN ('open', 'checkout_started');
      `;
      return NextResponse.json({ ok: true, status: "emptied" });
    }

    const user = await getCurrentUser();
    const email = clean(body.email || user?.email || "", 240).toLowerCase();
    const total = items.reduce((sum, line) => sum + (Number(line.unitPrice) || 0) * (Number(line.quantity) || 0), 0);
    const status = body.status === "checkout_started" ? "checkout_started" : "open";
    const orderWindowId = Number(body.orderWindowId) || null;
    const token = randomBytes(24).toString("base64url");

    await sql`
      INSERT INTO abandoned_carts (
        id, status, source, page_url, customer_name, customer_email, customer_phone,
        customer_address, delivery_type, shabbos_label, total, item_count, items,
        order_window_id, user_id, recovery_token, last_seen_at, updated_at
      ) VALUES (
        ${cartId}, ${status}, 'storefront', ${clean(body.pageUrl, 400)},
        ${clean(body.name || user?.name || "", 160)}, ${email || null}, ${clean(body.phone || user?.phone || "", 60)},
        ${clean(body.address || user?.address || "", 400)}, ${clean(body.fulfillment, 40)},
        ${clean(body.windowLabel, 160)}, ${total.toFixed(2)}, ${itemCount},
        ${JSON.stringify(items)}::jsonb, ${orderWindowId}, ${user?.id ?? null}, ${token}, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        -- A cart that is already ordered or dismissed must never be dragged
        -- back into the reminder pool by a stale browser tab.
        status = CASE WHEN abandoned_carts.status IN ('ordered', 'recovered', 'dismissed')
                      THEN abandoned_carts.status ELSE EXCLUDED.status END,
        items = EXCLUDED.items,
        item_count = EXCLUDED.item_count,
        total = EXCLUDED.total,
        order_window_id = COALESCE(EXCLUDED.order_window_id, abandoned_carts.order_window_id),
        shabbos_label = COALESCE(NULLIF(EXCLUDED.shabbos_label, ''), abandoned_carts.shabbos_label),
        delivery_type = COALESCE(NULLIF(EXCLUDED.delivery_type, ''), abandoned_carts.delivery_type),
        -- Contact details only ever fill in; a later anonymous ping must not
        -- wipe an email we already captured.
        customer_email = COALESCE(NULLIF(EXCLUDED.customer_email, ''), abandoned_carts.customer_email),
        customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''), abandoned_carts.customer_name),
        customer_phone = COALESCE(NULLIF(EXCLUDED.customer_phone, ''), abandoned_carts.customer_phone),
        customer_address = COALESCE(NULLIF(EXCLUDED.customer_address, ''), abandoned_carts.customer_address),
        user_id = COALESCE(EXCLUDED.user_id, abandoned_carts.user_id),
        recovery_token = COALESCE(abandoned_carts.recovery_token, EXCLUDED.recovery_token),
        last_seen_at = now(),
        updated_at = now();
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cart tracking failed", error);
    // Never surface this to the shopper: tracking is a background nicety and
    // must not interrupt an order in progress.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
