import { NextResponse } from "next/server";
import Stripe from "stripe";
import { completeCheckoutSession } from "@/lib/checkout/complete";

/**
 * Fast path only. This runs when the customer stays on the page through
 * payment. The Stripe webhook (/api/stripe/webhook) is the guarantee; both call
 * the same atomically-claimed routine, so whichever arrives first wins and the
 * other becomes a no-op.
 */
export async function POST(request: Request) {
  try {
    const { paymentIntentId } = await request.json();
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const result = await completeCheckoutSession(paymentIntentId, stripe, "browser");

    if (result.ok) {
      return NextResponse.json({ ok: true, state: result.state });
    }

    const status =
      result.state === "not_found" ? 404 :
      result.state === "not_paid" ? 409 :
      result.state === "amount_mismatch" ? 409 :
      502;

    return NextResponse.json({ error: result.error }, { status });
  } catch (error) {
    console.error("Checkout completion error", error);
    return NextResponse.json({ error: "Unable to complete the order." }, { status: 500 });
  }
}
