import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { completeCheckoutSession } from "@/lib/checkout/complete";

/**
 * The single Stripe webhook for the site.
 *
 * Palate already had an endpoint registered at this exact URL
 * (`https://www.palatecateringisrael.com/api/stripe/webhook`), served by the
 * legacy `api/stripe/webhook.js`. Once the project became a Next.js app this
 * route takes that path, so the legacy handler's work had to move here or it
 * would have stopped silently — taking payment links and abandoned-cart
 * recovery with it.
 *
 * Two payment flows therefore land here and are told apart by metadata:
 *
 *  - New storefront checkout — a `checkout_sessions` row exists for the
 *    PaymentIntent. This is the path that turns a payment into an order, and it
 *    matters most for 3-D Secure, where the customer never returns to the page.
 *  - Legacy payment links — the intent carries `order_id` and/or a cart id in
 *    metadata, and an order row already exists awaiting payment.
 *
 * Uses the existing STRIPE_WEBHOOK_SECRET; no new endpoint is required.
 */

// Signature verification needs the exact bytes Stripe signed.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeCartId(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{6,64}$/.test(raw) ? raw : "";
}

/**
 * Legacy behaviour, preserved verbatim in effect: mark payment-link items paid,
 * clear the pending link, move the order out of 'payment_link_sent', and record
 * a recovered abandoned cart.
 */
async function applyLegacyMetadata(metadata: Record<string, string>) {
  const orderId = Number(metadata.order_id || 0);
  const recoveredCartId = normalizeCartId(metadata.recovered_cart_id || metadata.cart_id);

  if (orderId) {
    try {
      const { rows } = await sql`SELECT items FROM orders WHERE id = ${orderId};`;
      if (rows.length) {
        const items = Array.isArray(rows[0].items) ? (rows[0].items as Record<string, unknown>[]) : [];
        const updated = items.map((item) =>
          item.pending ? { ...item, pending: false, paid: true } : item,
        );
        await sql`
          UPDATE orders
          SET items = ${JSON.stringify(updated)}::jsonb,
              pending_payment_link = NULL,
              pending_payment_url = NULL,
              status = CASE WHEN status = 'payment_link_sent' THEN 'new' ELSE status END
          WHERE id = ${orderId};
        `;
      }
    } catch (error) {
      console.error("Webhook order update failed", error);
    }
  }

  if (recoveredCartId) {
    try {
      await sql`
        UPDATE abandoned_carts
        SET status = 'recovered',
            order_id = ${orderId || null},
            ordered_at = COALESCE(ordered_at, now()),
            updated_at = now()
        WHERE id = ${recoveredCartId};
      `;
    } catch (error) {
      console.error("Webhook abandoned cart update failed", error);
    }
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET/STRIPE_SECRET_KEY is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const stripe = new Stripe(stripeKey);
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // The endpoint subscribes to three events; only these two represent money in.
  if (event.type !== "payment_intent.succeeded" && event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const object = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session;
  const metadata = (object.metadata || {}) as Record<string, string>;

  try {
    // Legacy first: it is cheap, independent, and never throws out of its own
    // try/catch, so it cannot block order creation.
    await applyLegacyMetadata(metadata);

    if (event.type !== "payment_intent.succeeded") {
      return NextResponse.json({ received: true });
    }

    const intent = object as Stripe.PaymentIntent;
    const result = await completeCheckoutSession(intent.id, stripe, "webhook");

    if (!result.ok) {
      // No checkout_sessions row means this was a legacy payment link, which the
      // step above already handled — acknowledge rather than make Stripe retry.
      if (result.state === "not_found") {
        return NextResponse.json({ received: true, handled: "legacy" });
      }
      console.error(`Webhook completion failed for ${intent.id}: ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ received: true, state: result.state });
  } catch (error) {
    console.error("Stripe webhook handler error", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
