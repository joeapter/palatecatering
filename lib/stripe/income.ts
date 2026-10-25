import Stripe from "stripe";

/**
 * Income as Stripe actually settled it, rather than as orders were booked.
 *
 * The two are not the same and should not be expected to match. An order row
 * is created whenever an order is taken, however it was paid — bank transfer,
 * Bit, cash on collection — while Stripe only knows about cards it processed.
 * Refunds move the other way: a refunded charge stops being income, but the
 * order it belonged to still sits in the orders table at its original value.
 *
 * So this reports money Stripe confirmed, net of refunds, and the dashboard
 * shows the booked figure alongside it rather than pretending one is wrong.
 */

export type IncomePeriod = { net: number; gross: number; refunded: number; count: number };
export type StripeIncome = { month: IncomePeriod; year: IncomePeriod; year_label: string };

/**
 * Epoch seconds for the start of a month in Israel.
 *
 * Israel is UTC+2 in winter and UTC+3 under daylight saving, so the offset
 * cannot be hard-coded — the year starts at +2 and August starts at +3. Both
 * candidates are tried and the one that genuinely reads as midnight local time
 * is the right one.
 */
function startOfMonthInIsrael(year: number, month: number): number {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  });
  for (const offsetHours of [2, 3]) {
    const guess = Date.UTC(year, month - 1, 1, 0, 0, 0) - offsetHours * 3600_000;
    const parts = Object.fromEntries(format.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === 1 &&
      Number(parts.hour) % 24 === 0
    ) {
      return Math.floor(guess / 1000);
    }
  }
  // Neither offset resolved (should not happen); fall back to +2.
  return Math.floor((Date.UTC(year, month - 1, 1) - 2 * 3600_000) / 1000);
}

function empty(): IncomePeriod {
  return { net: 0, gross: 0, refunded: 0, count: 0 };
}

// Stripe is an external call on a page that is loaded often, so results are
// held briefly. Ten minutes is far fresher than a daily figure needs to be and
// keeps a page refresh from hammering the API.
let cache: { at: number; value: StripeIncome } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function getStripeIncome(): Promise<StripeIncome | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const now = new Date();
  const israelToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
  const year = Number(israelToday.slice(0, 4));
  const month = Number(israelToday.slice(5, 7));

  const yearStart = startOfMonthInIsrael(year, 1);
  const monthStart = startOfMonthInIsrael(year, month);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const charges = await stripe.charges
      .list({ created: { gte: yearStart }, limit: 100 })
      .autoPagingToArray({ limit: 5000 });

    const monthTotals = empty();
    const yearTotals = empty();

    for (const charge of charges) {
      // Only settled card payments count. A charge that failed, or one that was
      // authorised and never captured, is not income.
      if (!charge.paid || charge.status !== "succeeded") continue;
      const gross = charge.amount / 100;
      const refunded = (charge.amount_refunded || 0) / 100;

      yearTotals.gross += gross;
      yearTotals.refunded += refunded;
      yearTotals.net += gross - refunded;
      yearTotals.count += 1;

      if (charge.created >= monthStart) {
        monthTotals.gross += gross;
        monthTotals.refunded += refunded;
        monthTotals.net += gross - refunded;
        monthTotals.count += 1;
      }
    }

    const value: StripeIncome = { month: monthTotals, year: yearTotals, year_label: String(year) };
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("Stripe income lookup failed", error);
    // The dashboard still has the booked figures; it must not fail because
    // Stripe is briefly unreachable.
    return null;
  }
}
