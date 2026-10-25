import nodemailer from "nodemailer";

/**
 * Outbound mail for the storefront.
 *
 * Deliberately the same Gmail credentials the order pipeline already uses, so
 * reminders arrive from the address customers have corresponded with rather
 * than a second sender that lands in spam and looks like a phishing attempt.
 */
export function siteBaseUrl() {
  const explicit = process.env.PUBLIC_BASE_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.palatecateringisrael.com";
}

export function mailerConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASS);
}

export async function sendMail({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!mailerConfigured()) throw new Error("GMAIL_USER / GMAIL_APP_PASS are not configured.");

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
  });

  await transport.sendMail({
    from: `${process.env.ORDER_FROM_NAME || "Palate Catering"} <${process.env.GMAIL_USER}>`,
    to,
    replyTo: replyTo || process.env.ORDER_REPLY_TO || process.env.GMAIL_USER,
    subject,
    html,
  });
}

/** Shared shell so reminders look like the rest of the brand, not like spam. */
export function emailShell(body: string, footerNote = "") {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f2e8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18251f">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px">
    <p style="margin:0 0 24px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a85f44;font-weight:700">Palate Catering</p>
    ${body}
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:1.6;color:#18251f80;text-align:center">
    Palate Catering · Beit Shemesh · <a href="tel:+972587280062" style="color:#18251f80">058-728-0062</a><br>${footerNote}
  </p>
</body></html>`;
}
