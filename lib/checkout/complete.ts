import { sql } from "@vercel/postgres";
import { alertFailedCheckout } from "./alert";
import Stripe from "stripe";

/**
 * Turning a succeeded PaymentIntent into a real order.
 *
 * Two things drive this: the browser right after payment, and the Stripe
 * webhook. The webhook is the one that must not be removed — card payments in
 * Israel routinely go through 3-D Secure, which navigates the customer away
 * from the page, so the browser call cannot be relied on to happen at all.
 *
 * Both callers land here, and the work is claimed atomically, so a customer who
 * pays once gets exactly one order no matter how many times this runs or how
 * closely the two paths race each other.
 */

export type CompletionSource = "browser" | "webhook" | "manual";

export type CompletionResult =
  | { ok: true; state: "completed" | "already_complete" | "in_progress" }
  | { ok: false; state: "not_found" | "not_paid" | "amount_mismatch" | "dispatch_failed"; error: string };

/** Orders that arrive after cutoff are still fulfilled, but the kitchen is told. */
const LATE_ORDER_GRACE_MS = 15 * 60 * 1000;

function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

async function releaseClaim(paymentIntentId: string, error: string) {
  await sql`
    UPDATE checkout_sessions
    SET status = 'failed', last_error = ${error.slice(0, 1000)}, updated_at = now()
    WHERE payment_intent_id = ${paymentIntentId};
  `;
}

export async function completeCheckoutSession(
  paymentIntentId: string,
  stripe: Stripe,
  source: CompletionSource = "browser",
): Promise<CompletionResult> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    return { ok: false, state: "not_paid", error: "Payment has not completed." };
  }

  // Claim the session. Only one caller can move it out of pending/failed, which
  // is what stops a browser call and a webhook arriving together from both
  // dispatching the same order.
  const claim = await sql`
    UPDATE checkout_sessions
    SET status = 'processing',
        attempts = attempts + 1,
        last_attempt_at = now(),
        updated_at = now()
    WHERE payment_intent_id = ${paymentIntentId}
      AND status IN ('pending', 'failed')
    RETURNING payload, amount, order_window_id;
  `;

  if (claim.rowCount === 0) {
    const existing = await sql`
      SELECT status FROM checkout_sessions WHERE payment_intent_id = ${paymentIntentId} LIMIT 1;
    `;
    const status = existing.rows[0]?.status;
    if (!status) {
      return { ok: false, state: "not_found", error: "Checkout record not found." };
    }
    if (status === "complete") return { ok: true, state: "already_complete" };
    // Another caller holds the claim and is mid-dispatch.
    return { ok: true, state: "in_progress" };
  }

  const session = claim.rows[0];

  try {
    const expectedAgorot = Math.round(Number(session.amount) * 100);
    if (intent.amount_received !== expectedAgorot) {
      const message = `Amount mismatch: charged ${intent.amount_received}, expected ${expectedAgorot}.`;
      await releaseClaim(paymentIntentId, message);
      await alertFailedCheckout({
        paymentIntentId, amount: session.amount, reason: message,
        customer: (session.payload as { customer?: Record<string, string> })?.customer,
      });
      return { ok: false, state: "amount_mismatch", error: "Payment amount could not be verified." };
    }

    const payload = { ...(session.payload as Record<string, unknown>) };

    // Carry the order window and the account through to the order row. Without
    // the window every order landed with order_window_id NULL, so the admin's
    // "orders this window" and revenue tiles counted nothing and always read
    // zero — the orders were there, nothing tied them to a date.
    payload.orderWindowId = session.order_window_id;
    const accountId = Number(intent.metadata?.user_id || 0);
    if (accountId) payload.userId = accountId;

    // The cutoff is enforced before payment, in the intent route. By this point
    // the customer has been charged, so refusing the order would take money for
    // food nobody is making. Fulfil it and make the lateness impossible to miss.
    const windowRow = await sql`
      SELECT cutoff_at FROM order_windows WHERE id = ${session.order_window_id} LIMIT 1;
    `;
    const cutoffAt = windowRow.rows[0]?.cutoff_at ? new Date(windowRow.rows[0].cutoff_at) : null;
    if (cutoffAt && Date.now() > cutoffAt.getTime() + LATE_ORDER_GRACE_MS) {
      const banner = `⚠️ LATE ORDER — paid ${new Date().toISOString()}, after the ${cutoffAt.toISOString()} cutoff. Confirm with the customer before producing.`;
      payload.notes = payload.notes ? `${banner}\n\n${payload.notes}` : banner;
      payload.lateSubmission = true;
    }

    const response = await fetch(`${siteBaseUrl()}/api/send-order-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const message = `send-order-email responded ${response.status}: ${detail.slice(0, 400)}`;
      await releaseClaim(paymentIntentId, message);
      // The money is taken and the kitchen has nothing. Tell someone now
      // rather than waiting for the customer to notice.
      await alertFailedCheckout({
        paymentIntentId,
        amount: session.amount,
        reason: `Order dispatch failed — ${response.status} from the order pipeline.`,
        customer: payload.customer as { name?: string; email?: string; phone?: string },
        items: payload.items as Array<{ title?: string; quantity?: number }>,
        windowLabel: payload.shabbosLabel as string,
      });
      return {
        ok: false,
        state: "dispatch_failed",
        error: "Payment succeeded, but order processing needs attention.",
      };
    }

    await sql`
      UPDATE checkout_sessions
      SET status = 'complete',
          completed_at = now(),
          completed_by = ${source},
          last_error = NULL,
          updated_at = now()
      WHERE payment_intent_id = ${paymentIntentId};
    `;

    // Close the abandoned-cart row this order came from, so no reminder is ever
    // sent to someone who has already paid. Wrapped in its own try/catch: a
    // bookkeeping failure here must not turn a completed order into an error.
    const cartId = String(intent.metadata?.recovered_cart_id || "");
    if (/^[A-Za-z0-9_-]{8,64}$/.test(cartId)) {
      try {
        await sql`
          UPDATE abandoned_carts
          SET status = 'ordered',
              ordered_at = COALESCE(ordered_at, now()),
              reminder_stop_reason = COALESCE(reminder_stop_reason, 'ordered'),
              updated_at = now()
          WHERE id = ${cartId};
        `;
        // Credit the reminder that did the work, if one was sent. Revenue with
        // no attribution is indistinguishable from revenue the emails did not
        // earn, which is the whole question the owner is asking of them.
        await sql`
          UPDATE cart_reminder_log
          SET recovered_at = COALESCE(recovered_at, now())
          WHERE cart_id = ${cartId} AND ok = true AND recovered_at IS NULL;
        `;
      } catch (error) {
        console.error("Cart recovery bookkeeping failed", error);
      }
    }

    return { ok: true, state: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await releaseClaim(paymentIntentId, message);
    await alertFailedCheckout({ paymentIntentId, amount: session.amount, reason: message });
    return {
      ok: false,
      state: "dispatch_failed",
      error: "Payment succeeded, but order processing needs attention.",
    };
  }
}
