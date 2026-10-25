import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { getCurrentUser } from "@/lib/session";
import { listSavedCards, ownsPaymentMethod } from "@/lib/stripe/customer";

/**
 * The customer's saved cards: list them, and remove one.
 *
 * Saved cards are deliberately account-only. The alternative — keying them to
 * a typed email address — would mean anyone who entered that address at
 * checkout would be offered someone else's card. An authenticated session is
 * the only identifier strong enough to hang a stored payment method on.
 */
export const dynamic = "force-dynamic";

async function customerIdFor(userId: number) {
  const { rows } = await sql`SELECT stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1;`;
  return String(rows[0]?.stripe_customer_id || "").trim();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ cards: [] });

  try {
    const customerId = await customerIdFor(user.id);
    // No customer yet simply means they have never saved a card.
    if (!customerId) return NextResponse.json({ cards: [] });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    return NextResponse.json({ cards: await listSavedCards(stripe, customerId) });
  } catch (error) {
    console.error("Saved card list failed", error);
    // A card list that cannot load must not block checkout — the page falls
    // back to entering a card by hand.
    return NextResponse.json({ cards: [] });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const { paymentMethodId } = await request.json();
    const customerId = await customerIdFor(user.id);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    if (!customerId || !(await ownsPaymentMethod(stripe, customerId, String(paymentMethodId || "")))) {
      return NextResponse.json({ error: "That card is not on your account." }, { status: 404 });
    }

    await stripe.paymentMethods.detach(String(paymentMethodId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Saved card removal failed", error);
    return NextResponse.json({ error: "That card could not be removed." }, { status: 500 });
  }
}
