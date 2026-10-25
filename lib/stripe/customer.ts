import { sql } from "@vercel/postgres";
import type Stripe from "stripe";
import type { AccountUser } from "@/lib/session";

/**
 * Returns the Stripe customer id for an account, creating it on first use.
 *
 * Card details never reach this database. Stripe vaults the card; all we hold
 * is this `cus_...` reference, which cannot be used to charge anyone outside
 * our own Stripe account. That is the entire reason saved cards are done this
 * way rather than by storing anything ourselves.
 *
 * A stored id can go stale — a customer deleted in the Stripe dashboard, or a
 * key rotated from test to live — so a stored id is verified before it is
 * trusted, and quietly replaced if it no longer resolves.
 */
export async function ensureStripeCustomer(stripe: Stripe, user: AccountUser): Promise<string> {
  const { rows } = await sql`SELECT stripe_customer_id FROM users WHERE id = ${user.id} LIMIT 1;`;
  const existing = String(rows[0]?.stripe_customer_id || "").trim();

  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing);
      if (!customer.deleted) return existing;
    } catch {
      // Falls through to create a replacement below.
    }
  }

  const created = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    phone: user.phone || undefined,
    metadata: { user_id: String(user.id) },
  });

  await sql`UPDATE users SET stripe_customer_id = ${created.id}, updated_at = now() WHERE id = ${user.id};`;
  return created.id;
}

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isExpired: boolean;
};

/**
 * The customer's saved cards.
 *
 * Everything here was saved by an explicit tick of "save my card" — the
 * checkout only ever asks Stripe to retain a card when the box is checked — so
 * the list needs no further consent filtering.
 */
export async function listSavedCards(stripe: Stripe, customerId: string): Promise<SavedCard[]> {
  const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 20 });
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();

  return methods.data
    .filter((method) => method.card)
    .map((method) => {
      const card = method.card!;
      // Stripe's exp_month is 1-based; the comparison below is 0-based.
      const expiresAfter = card.exp_year * 12 + (card.exp_month - 1);
      return {
        id: method.id,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        isExpired: expiresAfter < thisMonth,
      };
    });
}

/**
 * Confirms a payment method is one of this customer's own before it is charged
 * or detached. Without this check a caller could pass any `pm_...` id they had
 * seen and act on someone else's card.
 */
export async function ownsPaymentMethod(stripe: Stripe, customerId: string, paymentMethodId: string) {
  if (!/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) return false;
  try {
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    return method.customer === customerId;
  } catch {
    return false;
  }
}
