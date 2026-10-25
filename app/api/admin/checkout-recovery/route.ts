import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import Stripe from "stripe";
import { completeCheckoutSession } from "@/lib/checkout/complete";

/**
 * Recovery surface for payments that were taken but never became orders.
 *
 * The webhook makes this rare, but "rare" is not "never": the order-email
 * pipeline can fail, Gmail can reject, the kitchen queue can be down. When that
 * happens the customer has paid and nobody knows. This endpoint is how that
 * becomes visible and fixable.
 *
 * GET  — sessions that are paid (or unknown) and not yet complete.
 * POST — retry completion for one payment_intent_id.
 */

export const dynamic = "force-dynamic";

/**
 * Accepts the admin cookie like every other admin route. It previously required
 * the raw password in an `x-admin-key` header, which the signed-in dashboard
 * never sends — so the "payment needs attention" panel could list nothing and
 * its retry button could never fire. `isAdminRequest` still honours the header
 * for older tooling.
 */
function authorized(request: Request): boolean {
  return isAdminRequest(request);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    // Anything incomplete and older than a couple of minutes. Younger rows are
    // usually just a checkout in progress and would be noise.
    const rows = await sql`
      SELECT payment_intent_id, order_window_id, amount, status, attempts,
             last_error, last_attempt_at, created_at, payload
      FROM checkout_sessions
      WHERE status <> 'complete'
        AND created_at < now() - interval '2 minutes'
      ORDER BY created_at DESC
      LIMIT 100;
    `;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // An abandoned checkout and a paid-but-unfulfilled order look identical in
    // our table. Stripe is the only place that knows which is which.
    const enriched = await Promise.all(
      rows.rows.map(async (row) => {
        let paymentStatus = "unknown";
        let amountReceived: number | null = null;
        try {
          const intent = await stripe.paymentIntents.retrieve(row.payment_intent_id);
          paymentStatus = intent.status;
          amountReceived = intent.amount_received;
        } catch {
          paymentStatus = "lookup_failed";
        }
        const payload = (row.payload || {}) as { customer?: { name?: string; email?: string } };
        return {
          paymentIntentId: row.payment_intent_id,
          status: row.status,
          paymentStatus,
          needsAction: paymentStatus === "succeeded",
          amount: Number(row.amount),
          amountReceived: amountReceived == null ? null : amountReceived / 100,
          attempts: row.attempts,
          lastError: row.last_error,
          lastAttemptAt: row.last_attempt_at,
          createdAt: row.created_at,
          customerName: payload.customer?.name || "",
          customerEmail: payload.customer?.email || "",
        };
      }),
    );

    // Paid-but-incomplete first — that is the only group that costs anyone money.
    enriched.sort((a, b) => Number(b.needsAction) - Number(a.needsAction));

    return NextResponse.json({
      sessions: enriched,
      paidIncomplete: enriched.filter((s) => s.needsAction).length,
    });
  } catch (error) {
    console.error("Checkout recovery list error", error);
    return NextResponse.json({ error: "Unable to load checkout sessions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const { paymentIntentId } = await request.json();
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ error: "paymentIntentId is required." }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const result = await completeCheckoutSession(paymentIntentId, stripe, "manual");

    if (result.ok) {
      return NextResponse.json({ ok: true, state: result.state });
    }
    return NextResponse.json({ error: result.error, state: result.state }, { status: 409 });
  } catch (error) {
    console.error("Checkout recovery retry error", error);
    return NextResponse.json({ error: "Retry failed." }, { status: 500 });
  }
}
