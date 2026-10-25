import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { mailerConfigured } from "@/lib/mailer";
import { loadCandidates, sendReminder, stageFor, stopSequence } from "@/lib/cart-recovery";
import { sweepUnalertedPayments } from "@/lib/checkout/alert";
import Stripe from "stripe";

/**
 * The scheduled sweep that sends abandoned-cart reminders.
 *
 * Scheduling note. This project is on a Vercel plan that only triggers cron
 * once a day, so `vercel.json` asks for 07:00 UTC — 10:00 in Israel. That hour
 * is chosen deliberately: for a Wednesday 23:59 cutoff it falls about fourteen
 * hours before closing, which is where the deadline reminder belongs, and on
 * other days it picks up yesterday's abandoned baskets. One run a day maps
 * neatly onto a weekly ordering rhythm — leave on Sunday, and the three touches
 * land Monday, Tuesday and Wednesday morning.
 *
 * The stage rules are still written for a more frequent sweep, because a
 * more frequent one is better: it puts the first reminder an hour after the
 * customer leaves rather than the next morning. Point any external scheduler
 * at this endpoint hourly with the CRON_SECRET as a bearer token and the
 * cadence tightens with no other change.
 *
 * Safe to run twice: the log claim in `sendReminder` is what prevents a
 * duplicate, not the timing of this endpoint.
 *
 * `?dry=1` reports what it would send without sending, which is how to inspect
 * the schedule on a live database without mailing customers.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request) {
  // Vercel Cron presents the project's CRON_SECRET as a bearer token.
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return true;
  // An admin can also run it by hand from the recovery screen.
  return isAdminRequest(request);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  if (!dryRun && !mailerConfigured()) {
    return NextResponse.json({ error: "Mail is not configured." }, { status: 503 });
  }

  try {
    const carts = await loadCandidates();
    const now = new Date();
    const planned: { cart: string; stage: string; email: string }[] = [];
    const stopped: { cart: string; reason: string }[] = [];
    const failures: { cart: string; error: string }[] = [];
    let sent = 0;

    for (const cart of carts) {
      const decision = stageFor(cart, now);
      if (!decision) continue;

      if ("stop" in decision) {
        stopped.push({ cart: cart.id, reason: decision.stop });
        if (!dryRun) await stopSequence(cart.id, decision.stop);
        continue;
      }

      planned.push({ cart: cart.id, stage: decision.stage, email: cart.customer_email });
      if (dryRun) continue;

      const result = await sendReminder(cart, decision.stage);
      if (result.sent) sent += 1;
      else if (result.reason === "error") failures.push({ cart: cart.id, error: result.error || "unknown" });
    }

    // Runs on the same schedule as the reminders so no second cron is needed.
    // Independent of the reminder outcome: a paid order with nothing in the
    // kitchen matters whether or not any reminders went out.
    let paymentsAlerted: string[] = [];
    if (!dryRun && process.env.STRIPE_SECRET_KEY) {
      try {
        paymentsAlerted = await sweepUnalertedPayments(new Stripe(process.env.STRIPE_SECRET_KEY));
      } catch (error) {
        console.error("Stuck-payment sweep failed", error);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      paymentsAlerted,
      considered: carts.length,
      planned,
      sent,
      stopped,
      failures,
    });
  } catch (error) {
    console.error("Cart reminder sweep failed", error);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }
}
