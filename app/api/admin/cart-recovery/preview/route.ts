import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { renderReminder, type CandidateCart, type Stage } from "@/lib/cart-recovery";

/**
 * Renders a reminder exactly as a customer would receive it, without sending.
 *
 * Email that goes out automatically should be readable by the person whose name
 * is on it before it ever reaches a customer, not discovered afterwards from a
 * complaint.
 */
export const dynamic = "force-dynamic";

const STAGES: Stage[] = ["first", "second", "last_call"];

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const stage = (url.searchParams.get("stage") || "first") as Stage;
  if (!STAGES.includes(stage)) return new NextResponse("Unknown stage", { status: 400 });

  const cartId = url.searchParams.get("cart");

  try {
    const { rows } = cartId
      ? await sql`
          SELECT ac.*, ow.name AS window_name, ow.cutoff_at
          FROM abandoned_carts ac LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
          WHERE ac.id = ${cartId} LIMIT 1;`
      : await sql`
          SELECT ac.*, ow.name AS window_name, ow.cutoff_at
          FROM abandoned_carts ac LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
          WHERE ac.item_count > 0 ORDER BY ac.last_seen_at DESC LIMIT 1;`;

    // With no carts at all there is still a template worth looking at, so fall
    // back to a representative example rather than an error page.
    const cart: CandidateCart = (rows[0] as CandidateCart) || {
      id: "example", customer_email: "customer@example.com", customer_name: "Rivky",
      items: [
        { title: "Chummus", quantity: 2, unitPrice: 25, variantLabel: "250 ml" },
        { title: "Balsamic Glazed Brisket", quantity: 1, unitPrice: 180, variantLabel: "1 kg" },
      ],
      total: "230.00", item_count: 3, recovery_token: "example-token", reminders_sent: 0,
      last_reminder_at: null, last_seen_at: new Date().toISOString(), shabbos_label: null,
      cutoff_at: null, window_name: "Shabbos · 21 Aug", sent_stages: [],
    };

    const { subject, html } = renderReminder(cart, stage);
    // The subject is not visible in a rendered body, so it is shown above it.
    const banner = `<div style="max-width:560px;margin:0 auto 12px;padding:12px 16px;background:#18251f;color:#fff;border-radius:12px;font:600 13px -apple-system,sans-serif">
      Subject: ${subject}</div>`;
    return new NextResponse(html.replace("<body", `<body`).replace(/(<body[^>]*>)/, `$1${banner}`), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Reminder preview failed", error);
    return new NextResponse("Preview failed", { status: 500 });
  }
}
