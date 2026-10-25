import nodemailer from "nodemailer";

/**
 * Branded transactional email for the notifications the order pipeline does not
 * already send (status changes, reminders). Order confirmations still come from
 * the existing `api/send-order-email.js` pipeline — duplicating that would risk
 * two confirmations for one order.
 */

const BRAND = {
  name: "Palate Catering",
  phone: "058-728-0062",
  site: "https://www.palatecateringisrael.com",
  ink: "#26201b",
  cream: "#faf7f2",
  accent: "#8a2333",
};

function transport() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE ?? "true") !== "false",
    auth: { user, pass },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tables and inline styles because email clients still do not do layout. */
export function renderEmail({
  heading,
  body,
  ctaLabel,
  ctaHref,
}: {
  heading: string;
  body: string[];
  ctaLabel?: string;
  ctaHref?: string;
}): string {
  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:26px;color:${BRAND.ink};">${escapeHtml(line)}</p>`,
    )
    .join("");

  const cta =
    ctaLabel && ctaHref
      ? `<p style="margin:28px 0 0;"><a href="${ctaHref}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold;font-size:14px;">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BRAND.cream};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:36px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.accent};font-weight:bold;">${BRAND.name}</p>
        <h1 style="margin:0 0 22px;font-size:28px;line-height:34px;color:${BRAND.ink};">${escapeHtml(heading)}</h1>
        ${paragraphs}
        ${cta}
      </td></tr>
      <tr><td style="padding-top:30px;border-top:1px solid #e5dcd0;">
        <p style="margin:16px 0 0;font-size:13px;line-height:22px;color:#6f6258;">
          Delicious Mehadrin food, prepared with care for Shabbos tables, Yom Tov, and simchas.<br>
          ${BRAND.phone} · <a href="${BRAND.site}" style="color:${BRAND.accent};">palatecateringisrael.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export async function sendEmail({
  to,
  subject,
  heading,
  body,
  ctaLabel,
  ctaHref,
}: {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  ctaLabel?: string;
  ctaHref?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const mailer = transport();
  if (!mailer) return { ok: false, error: "Email is not configured." };
  try {
    await mailer.sendMail({
      from: `"${process.env.ORDER_FROM_NAME || BRAND.name}" <${process.env.GMAIL_USER || process.env.SMTP_USER}>`,
      to,
      replyTo: process.env.ORDER_REPLY_TO || undefined,
      subject,
      html: renderEmail({ heading, body, ctaLabel, ctaHref }),
      text: [heading, "", ...body].join("\n"),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Send failed." };
  }
}
