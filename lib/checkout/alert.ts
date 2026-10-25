import { sql } from "@vercel/postgres";
import { emailShell, mailerConfigured, sendMail, siteBaseUrl } from "@/lib/mailer";

/**
 * Raises the alarm when a customer has paid and no order exists.
 *
 * This is the failure that costs the most and shows the least: Stripe has the
 * money, the customer believes they have ordered, and the kitchen has nothing.
 * On 18 August it happened twice to one customer and was only found because she
 * said so. The system already refused to fabricate an order it could not
 * dispatch and queued it for recovery — what was missing was anyone being told.
 *
 * Sent once per payment. The claim below is the dedupe: the browser and the
 * Stripe webhook both run the same completion routine, usually seconds apart,
 * and without it a single failure would send two identical alarms.
 */

type AlertInput = {
  paymentIntentId: string;
  amount?: number | string | null;
  reason: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  items?: Array<{ title?: string; quantity?: number }> | null;
  windowLabel?: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

/** The alert as the recipient sees it. Separated so it can be previewed. */
export function renderFailedCheckoutEmail(input: AlertInput) {
  const amount = Number(String(input.amount ?? 0).replace(/[^0-9.]/g, "")) || 0;
  const customer = input.customer || {};
  const items = (input.items || [])
    .slice(0, 20)
    .map((item) => `${item.quantity ?? 1}× ${escapeHtml(String(item.title || "Item"))}`)
    .join("<br>");

  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a12c2c">Action needed</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:600">
      A customer paid and no order was created.
    </h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#18251fcc">
      Stripe has taken <b>₪${amount.toFixed(2)}</b> and nothing has reached the kitchen.
      Nothing has been sent to the customer either. Open the admin and retry it —
      if the retry succeeds the order is created normally and the customer is emailed.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#18251f99;width:110px">Customer</td><td style="padding:6px 0"><b>${escapeHtml(String(customer.name || "—"))}</b></td></tr>
      <tr><td style="padding:6px 0;color:#18251f99">Email</td><td style="padding:6px 0">${escapeHtml(String(customer.email || "—"))}</td></tr>
      <tr><td style="padding:6px 0;color:#18251f99">Phone</td><td style="padding:6px 0">${escapeHtml(String(customer.phone || "—"))}</td></tr>
      <tr><td style="padding:6px 0;color:#18251f99">For</td><td style="padding:6px 0">${escapeHtml(String(input.windowLabel || "—"))}</td></tr>
      ${items ? `<tr><td style="padding:6px 0;color:#18251f99;vertical-align:top">Items</td><td style="padding:6px 0">${items}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#18251f99;vertical-align:top">Payment</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${escapeHtml(input.paymentIntentId)}</td></tr>
      <tr><td style="padding:6px 0;color:#18251f99;vertical-align:top">Reason</td><td style="padding:6px 0;color:#a12c2c">${escapeHtml(input.reason.slice(0, 300))}</td></tr>
    </table>
    <a href="${siteBaseUrl()}/admin/orders" style="display:block;margin-top:24px;background:#18251f;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:999px;font-weight:700;font-size:15px">
      Open the admin and retry
    </a>`;

  return {
    subject: `⚠️ Paid ₪${amount.toFixed(0)} — no order created (${customer.name || customer.email || input.paymentIntentId})`,
    html: emailShell(body, "Sent automatically because a payment succeeded without producing an order."),
  };
}

export async function alertFailedCheckout(input: AlertInput): Promise<{ sent: boolean; reason?: string }> {
  const { paymentIntentId } = input;
  if (!paymentIntentId) return { sent: false, reason: "no_intent" };

  // Claim first, send second. A failure to send releases nothing — better a
  // missed duplicate than two alarms for one problem.
  let claimed = false;
  try {
    const claim = await sql`
      UPDATE checkout_sessions
      SET alerted_at = now(), alert_reason = ${input.reason.slice(0, 500)}
      WHERE payment_intent_id = ${paymentIntentId} AND alerted_at IS NULL
      RETURNING payment_intent_id;
    `;
    claimed = (claim.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Alert claim failed", error);
    // If the claim cannot be written, still send — being told twice about lost
    // money is far better than not being told at all.
    claimed = true;
  }
  if (!claimed) return { sent: false, reason: "already_alerted" };

  if (!mailerConfigured()) {
    console.error(`PAID CHECKOUT WITH NO ORDER ${paymentIntentId}: ${input.reason} (mail not configured)`);
    return { sent: false, reason: "mail_unconfigured" };
  }

  const to = process.env.ORDER_TO || process.env.GMAIL_USER || "";
  const cc = process.env.ORDER_CC || "";
  const recipients = [to, cc].filter(Boolean).join(",");
  if (!recipients) return { sent: false, reason: "no_recipients" };

  const { subject, html } = renderFailedCheckoutEmail(input);

  try {
    await sendMail({ to: recipients, subject, html });
    return { sent: true };
  } catch (error) {
    console.error("Failed-checkout alert could not be sent", error);
    return { sent: false, reason: "send_failed" };
  }
}

/**
 * Backstop sweep: paid in Stripe, incomplete here, nobody told.
 *
 * The inline alerts above fire when the completion routine runs and fails.
 * They cannot fire if it never ran — a webhook that never arrived, a function
 * that died before reaching our code. This catches that, and is the reason the
 * alerting does not depend on the very code path that is broken.
 */
export async function sweepUnalertedPayments(stripe: import("stripe").default) {
  const { rows } = await sql`
    SELECT payment_intent_id, amount, payload
    FROM checkout_sessions
    WHERE status <> 'complete'
      AND alerted_at IS NULL
      AND created_at < now() - interval '15 minutes'
      AND created_at > now() - interval '14 days'
    ORDER BY created_at DESC
    LIMIT 50;
  `;

  const alerted: string[] = [];
  for (const row of rows) {
    const paymentIntentId = String(row.payment_intent_id);
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      // Only money actually taken. An abandoned checkout is not an incident.
      if (intent.status !== "succeeded" || !intent.amount_received) continue;

      const payload = (row.payload || {}) as Record<string, unknown>;
      const result = await alertFailedCheckout({
        paymentIntentId,
        amount: row.amount,
        reason: "Payment succeeded but the order was never created — found by the safety sweep.",
        customer: payload.customer as { name?: string; email?: string; phone?: string },
        items: payload.items as Array<{ title?: string; quantity?: number }>,
        windowLabel: payload.shabbosLabel as string,
      });
      if (result.sent) alerted.push(paymentIntentId);
    } catch (error) {
      console.error(`Sweep could not check ${paymentIntentId}`, error);
    }
  }
  return alerted;
}
