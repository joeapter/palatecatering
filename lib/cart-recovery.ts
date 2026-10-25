import { sql } from "@vercel/postgres";
import { emailShell, sendMail, siteBaseUrl } from "./mailer";

/**
 * Abandoned-cart reminders.
 *
 * The usual e-commerce cadence — 1 hour, 24 hours, 72 hours after abandoning —
 * is wrong for this business. Palate cooks for a specific Shabbos and orders
 * shut at a fixed cutoff, so a reminder timed from when someone wandered off
 * regularly lands after the window has closed: not merely wasted, but actively
 * irritating, since the thing it asks for can no longer be bought.
 *
 * So the schedule is anchored to the cutoff, not to the abandonment:
 *
 *   first      an hour after they left, while it is still on their mind
 *   second     a day later, but only if the cutoff is still more than a day off
 *   last_call  on the closing day — the deadline mail, which usually earns its
 *              place — but never inside the final two hours, when there is no
 *              longer time to act on it
 *
 * Three sends at most, and the sequence stops the moment it should: they
 * ordered, they emptied the cart, they unsubscribed, or the cutoff passed.
 */

export type Stage = "first" | "second" | "last_call";

const HOUR = 60 * 60 * 1000;

/** Cadence in one place, so it can be re-tuned without hunting through logic. */
export const SCHEDULE = {
  firstAfterHours: 1,
  secondAfterHours: 24,
  /** Only send `second` when there is still this much room before the cutoff. */
  secondNeedsHoursBeforeCutoff: 24,
  /**
   * `last_call` becomes eligible once the cutoff is this close.
   *
   * Sixteen rather than a tighter number because the sweep may only run once a
   * day (see the note on scheduling in the cron route). A 10:00 run on a day
   * with a 23:59 cutoff sits about fourteen hours out, so a tighter window
   * would miss the deadline mail entirely on exactly the day it matters most.
   */
  lastCallWithinHours: 16,
  /** Never mail inside this window — too late to be acted on. */
  minHoursBeforeCutoff: 2,
  /** Never send two reminders closer together than this. */
  minGapHours: 6,
  maxReminders: 3,
  /**
   * Nothing older than this is ever mailed.
   *
   * Without this the first run would have written to everyone sitting in the
   * table from the old shop — the oldest live basket on production is seven
   * weeks old, and "your basket is waiting" about a cart from seven weeks ago
   * reads as spam, earns a complaint, and puts the deliverability of the
   * kitchen's order confirmations at risk. A basket is a live prospect for
   * about a week; after that it is a cold list.
   */
  staleAfterDays: 7,
};

export type CandidateCart = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  items: unknown;
  total: string | null;
  item_count: number;
  recovery_token: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
  last_seen_at: string;
  shabbos_label: string | null;
  cutoff_at: string | null;
  window_name: string | null;
  sent_stages: string[];
};

/**
 * Carts that are still live prospects. The narrowing that can be expressed in
 * SQL happens here; the timing decision is made in `stageFor` so it can be
 * reasoned about and tested directly.
 */
export async function loadCandidates(): Promise<CandidateCart[]> {
  const { rows } = await sql`
    SELECT ac.id, ac.customer_email, ac.customer_name, ac.items, ac.total, ac.item_count,
           ac.recovery_token, ac.reminders_sent, ac.last_reminder_at, ac.last_seen_at,
           ac.shabbos_label, ow.cutoff_at, ow.name AS window_name,
           COALESCE(
             ARRAY(SELECT stage FROM cart_reminder_log l
                    WHERE l.cart_id = ac.id AND l.ok = true),
             ARRAY[]::text[]
           ) AS sent_stages
    FROM abandoned_carts ac
    LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
    WHERE ac.status IN ('open', 'checkout_started')
      AND ac.customer_email IS NOT NULL AND ac.customer_email <> ''
      AND ac.unsubscribed_at IS NULL
      AND ac.item_count > 0
      AND ac.reminders_sent < ${SCHEDULE.maxReminders}
      AND ac.last_seen_at > now() - make_interval(days => ${SCHEDULE.staleAfterDays})
    ORDER BY ac.last_seen_at DESC
    LIMIT 200;
  `;
  return rows as CandidateCart[];
}

/**
 * Which reminder, if any, this cart is due right now. Returns null when it is
 * simply not time yet, and a stop reason when the sequence should end for good.
 */
export function stageFor(cart: CandidateCart, now = new Date()): { stage: Stage } | { stop: string } | null {
  const cutoff = cart.cutoff_at ? new Date(cart.cutoff_at) : null;
  const hoursToCutoff = cutoff ? (cutoff.getTime() - now.getTime()) / HOUR : null;

  // Past the cutoff there is nothing left to sell them for that date.
  if (hoursToCutoff !== null && hoursToCutoff <= 0) return { stop: "cutoff_passed" };

  const sent = new Set(cart.sent_stages || []);
  if (sent.size >= SCHEDULE.maxReminders) return { stop: "exhausted" };

  const idleHours = (now.getTime() - new Date(cart.last_seen_at).getTime()) / HOUR;
  const sinceLast = cart.last_reminder_at
    ? (now.getTime() - new Date(cart.last_reminder_at).getTime()) / HOUR
    : Infinity;

  // Two mails in quick succession read as pestering, whatever the stage rules
  // say in isolation.
  if (sinceLast < SCHEDULE.minGapHours) return null;

  // Too close to the cutoff to be useful.
  if (hoursToCutoff !== null && hoursToCutoff < SCHEDULE.minHoursBeforeCutoff) {
    return sent.size ? { stop: "cutoff_passed" } : null;
  }

  // The deadline mail takes precedence: on closing day it is the one that
  // matters, whether or not the earlier two ever went out.
  if (
    hoursToCutoff !== null &&
    hoursToCutoff <= SCHEDULE.lastCallWithinHours &&
    !sent.has("last_call") &&
    idleHours >= SCHEDULE.firstAfterHours
  ) {
    return { stage: "last_call" };
  }

  if (!sent.has("first") && idleHours >= SCHEDULE.firstAfterHours) {
    return { stage: "first" };
  }

  if (
    sent.has("first") &&
    !sent.has("second") &&
    idleHours >= SCHEDULE.secondAfterHours &&
    (hoursToCutoff === null || hoursToCutoff > SCHEDULE.secondNeedsHoursBeforeCutoff)
  ) {
    return { stage: "second" };
  }

  return null;
}

function itemRows(items: unknown) {
  const list = Array.isArray(items) ? items : [];
  return list
    .slice(0, 12)
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e2d6c2">
          <b style="font-weight:600">${escapeHtml(String(item.title || "Item"))}</b>
          <div style="font-size:12px;color:#18251f99">${qty} × ${escapeHtml(String(item.variantLabel || ""))}</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #e2d6c2;text-align:right;white-space:nowrap">₪${(qty * price).toFixed(2)}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

const COPY: Record<Stage, { subject: (c: CandidateCart) => string; lead: (c: CandidateCart) => string; button: string }> = {
  first: {
    subject: () => "Your Palate cart is waiting",
    lead: (cart) => `You left a few things in your basket${cart.window_name ? ` for ${escapeHtml(cart.window_name)}` : ""}. It is all still here — pick up where you left off.`,
    button: "Finish my order",
  },
  second: {
    subject: (cart) => cart.window_name ? `Still cooking for ${cart.window_name}?` : "Still thinking it over?",
    lead: (cart) => `Your basket is saved${cart.window_name ? ` for ${escapeHtml(cart.window_name)}` : ""}. If you need a hand deciding quantities, just reply to this email or send us a WhatsApp — we are happy to help you plan the right amount.`,
    button: "Return to my order",
  },
  last_call: {
    subject: (cart) => cart.window_name ? `Orders for ${cart.window_name} close tonight` : "Orders close tonight",
    lead: (cart) => `This is the last call — ordering for ${cart.window_name ? escapeHtml(cart.window_name) : "this week"} closes tonight, and your basket is still saved. After the cutoff we are into the kitchen and cannot add to the run.`,
    button: "Order before the cutoff",
  },
};

export function renderReminder(cart: CandidateCart, stage: Stage) {
  const base = siteBaseUrl();
  const restore = `${base}/cart/restore/${cart.recovery_token}`;
  const unsubscribe = `${base}/cart/unsubscribe/${cart.recovery_token}`;
  const copy = COPY[stage];
  const name = cart.customer_name ? String(cart.customer_name).split(" ")[0] : "";

  const body = `
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;line-height:1.2;font-weight:600">
      ${name ? `${escapeHtml(name)}, y` : "Y"}our basket is still here.
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18251fcc">${copy.lead(cart)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${itemRows(cart.items)}</table>
    <p style="margin:16px 0 24px;font-size:16px;text-align:right"><b>Total ₪${Number(cart.total || 0).toFixed(2)}</b></p>
    <a href="${restore}" style="display:block;background:#18251f;color:#fff;text-decoration:none;text-align:center;padding:16px;border-radius:999px;font-weight:700;font-size:15px">${copy.button}</a>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#18251f80">
      Prices are confirmed when you check out, so anything that has changed since will be shown before you pay.
    </p>`;

  return {
    subject: copy.subject(cart),
    html: emailShell(body, `<a href="${unsubscribe}" style="color:#18251f80">Stop these reminders</a>`),
  };
}

/**
 * Sends one reminder, claiming it in the log first.
 *
 * The claim is what makes a double-fire of the scheduler harmless: the unique
 * index on (cart_id, stage) where ok is true means the second attempt inserts
 * nothing and returns no row, so nobody is mailed twice. A send that then fails
 * marks its own row failed, which releases the claim for a later retry.
 */
export async function sendReminder(cart: CandidateCart, stage: Stage) {
  const claim = await sql`
    INSERT INTO cart_reminder_log (cart_id, stage, email)
    VALUES (${cart.id}, ${stage}, ${cart.customer_email})
    ON CONFLICT (cart_id, stage) WHERE ok = true DO NOTHING
    RETURNING id;
  `;
  if (claim.rowCount === 0) return { sent: false, reason: "already_sent" as const };

  const logId = claim.rows[0].id as number;
  try {
    const { subject, html } = renderReminder(cart, stage);
    await sendMail({ to: cart.customer_email, subject, html });
    await sql`
      UPDATE abandoned_carts
      SET reminders_sent = reminders_sent + 1,
          last_reminder_stage = ${stage},
          last_reminder_at = now(),
          contacted_at = COALESCE(contacted_at, now()),
          updated_at = now()
      WHERE id = ${cart.id};
    `;
    return { sent: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`UPDATE cart_reminder_log SET ok = false, error = ${message.slice(0, 400)} WHERE id = ${logId};`;
    return { sent: false, reason: "error" as const, error: message };
  }
}

export async function stopSequence(cartId: string, reason: string) {
  await sql`
    UPDATE abandoned_carts
    SET reminder_stop_reason = ${reason}, updated_at = now()
    WHERE id = ${cartId} AND reminder_stop_reason IS NULL;
  `;
}
