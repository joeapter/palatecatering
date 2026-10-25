import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { getCurrentUser } from "@/lib/session";
import { ownsPaymentMethod } from "@/lib/stripe/customer";

/**
 * Charges a card the customer saved on an earlier visit.
 *
 * Confirmation happens here rather than in the browser, which is what removes
 * the card form from a repeat order entirely — the customer taps once and the
 * server does the rest.
 *
 * The intent is created and its `checkout_sessions` row written by
 * /api/checkout/intent *before* this runs. That ordering matters: confirming a
 * payment whose session row did not yet exist would let the Stripe webhook
 * arrive first, find nothing to complete, and write the payment off as a legacy
 * payment link — taking the money without producing an order.
 *
 * Israeli issuers can still demand 3-D Secure on a saved card, so a
 * `requires_action` result is normal rather than a failure; the browser
 * finishes it with stripe.handleNextAction and the flow continues.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to use a saved card." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const paymentIntentId = String(body.paymentIntentId || "").trim();
    const paymentMethodId = String(body.paymentMethodId || "").trim();

    if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
      return NextResponse.json({ error: "That payment could not be found." }, { status: 400 });
    }

    // The session row proves this intent came from our own checkout at our own
    // prices, rather than being an id someone pasted in.
    const { rows: sessionRows } = await sql`
      SELECT status FROM checkout_sessions WHERE payment_intent_id = ${paymentIntentId} LIMIT 1;
    `;
    if (!sessionRows.length) {
      return NextResponse.json({ error: "That payment could not be found." }, { status: 404 });
    }
    if (sessionRows[0].status === "complete") {
      return NextResponse.json({ status: "succeeded", alreadyComplete: true });
    }

    const { rows: userRows } = await sql`SELECT stripe_customer_id FROM users WHERE id = ${user.id} LIMIT 1;`;
    const customerId = String(userRows[0]?.stripe_customer_id || "").trim();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    if (!customerId || !(await ownsPaymentMethod(stripe, customerId, paymentMethodId))) {
      return NextResponse.json({ error: "That card is not on your account." }, { status: 403 });
    }

    // The intent must belong to this same customer, or a signed-in shopper
    // could pay someone else's basket with their own saved card.
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.customer && intent.customer !== customerId) {
      return NextResponse.json({ error: "That payment could not be found." }, { status: 403 });
    }

    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      // The customer is right here on the page, so authentication may be shown.
      off_session: false,
      return_url: `${new URL(request.url).origin}/thank-you?payment_intent=${encodeURIComponent(paymentIntentId)}`,
    });

    return NextResponse.json({
      status: confirmed.status,
      clientSecret: confirmed.client_secret,
      paymentIntentId: confirmed.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That card could not be charged.";
    console.error("Saved-card payment failed", error);
    // Stripe's decline messages are written for customers, so they are passed
    // through rather than replaced with something vaguer.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
