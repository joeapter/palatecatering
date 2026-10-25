import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { isAdminRequest } from "@/lib/admin-auth";
import { emailShell, mailerConfigured, sendMail, siteBaseUrl } from "@/lib/mailer";
import { renderFailedCheckoutEmail } from "@/lib/checkout/alert";

/**
 * Proves outbound mail works, rather than assuming it does because the
 * credentials exist.
 *
 * GET  — opens a real SMTP session and authenticates, without sending. This is
 *        what distinguishes "the variables are set" from "Gmail accepts them";
 *        an app password revoked months ago looks identical to a working one
 *        until something tries to log in.
 * POST — sends one real message, to an address given in the body.
 *
 * Admin-only, because an endpoint that sends mail to an arbitrary address is
 * otherwise an open relay for someone else's spam.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `?preview=alert` renders the paid-but-no-order alert exactly as it would
  // arrive. Email that only appears when something has gone wrong should be
  // readable before that happens, not discovered mid-incident.
  if (new URL(request.url).searchParams.get("preview") === "alert") {
    const { subject, html } = renderFailedCheckoutEmail({
      paymentIntentId: "pi_3ExampleOnly000000000000",
      amount: 710,
      reason: "Order dispatch failed — 500 from the order pipeline.",
      customer: { name: "Aliza Mitnick", email: "customer@example.com", phone: "058-123-4567" },
      items: [{ title: "Sweet and Saucy Brisket", quantity: 1 }, { title: "Poppers", quantity: 1 }],
      windowLabel: "Shabbos · Aug 21 · Delivery to Beit Shemesh / RBS",
    });
    const banner = `<div style="max-width:560px;margin:0 auto 12px;padding:12px 16px;background:#18251f;color:#fff;border-radius:12px;font:600 13px -apple-system,sans-serif">Subject: ${subject}</div>`;
    return new NextResponse(html.replace(/(<body[^>]*>)/, `$1${banner}`), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const configured = mailerConfigured();
  const report: Record<string, unknown> = {
    configured,
    user: process.env.GMAIL_USER ? `${String(process.env.GMAIL_USER).slice(0, 3)}…@${String(process.env.GMAIL_USER).split("@")[1] || ""}` : null,
    // Where links in customer email will point. If this is a *.vercel.app
    // address, reminders would carry a hostname that changes on every deploy.
    linkBase: siteBaseUrl(),
    linkBaseLooksRight: !siteBaseUrl().includes(".vercel.app"),
    // Who receives a copy of every order. Reported from the running process
    // rather than from the dashboard, because that is the value that actually
    // decides where an order notification lands.
    orderNotifications: {
      to: process.env.ORDER_TO || null,
      cc: process.env.ORDER_CC || null,
      replyTo: process.env.ORDER_REPLY_TO || null,
    },
  };

  if (!configured) {
    return NextResponse.json({ ...report, ok: false, error: "GMAIL_USER / GMAIL_APP_PASS are not set." }, { status: 503 });
  }

  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
    });
    await transport.verify();
    return NextResponse.json({ ...report, ok: true, smtp: "authenticated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ...report, ok: false, smtp: "failed", error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { to } = await request.json();
    const address = String(to || process.env.ORDER_TO || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      return NextResponse.json({ error: "A valid address is required." }, { status: 400 });
    }

    await sendMail({
      to: address,
      subject: "Palate — mail delivery test",
      html: emailShell(`
        <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:600">Mail is working.</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#18251fcc">
          This was sent from the live site to confirm outbound email is configured correctly.
          Abandoned-basket reminders and order confirmations use this same sender.
        </p>
        <p style="margin:0;font-size:13px;color:#18251f99">Links in customer email will point at <b>${siteBaseUrl()}</b>.</p>`),
    });

    return NextResponse.json({ ok: true, sentTo: address });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Mail test failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
