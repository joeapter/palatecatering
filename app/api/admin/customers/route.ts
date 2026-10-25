import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

/**
 * The customer list, built from orders rather than a separate CRM, so it is
 * always the people who have actually bought. Used for cutoff reminders and the
 * weekly menu drop — the two messages that bring a weekly-purchase business
 * repeat orders.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const windowId = url.searchParams.get("windowId");

    // Everyone who has ordered, with whether they have ordered for the selected
    // week yet — that is exactly the list a cutoff reminder should target.
    const { rows } = await sql`
      SELECT lower(o.customer_email) AS email,
             MAX(o.customer_name) AS name,
             MAX(o.customer_phone) AS phone,
             count(*)::int AS order_count,
             MAX(o.created_at) AS last_order_at,
             -- COALESCE because older orders have no order_window_id: comparing
             -- NULL yields NULL, and bool_or over all-NULL is NULL, which would
             -- read as "unknown" rather than "has not ordered yet".
             COALESCE(bool_or(o.order_window_id = ${windowId ? Number(windowId) : null}), false) AS ordered_this_window
      FROM orders o
      WHERE COALESCE(o.is_deleted,false) = false
        AND COALESCE(o.customer_email, '') <> ''
      GROUP BY lower(o.customer_email)
      ORDER BY MAX(o.created_at) DESC
      LIMIT 500;
    `;
    return NextResponse.json({ customers: rows });
  } catch (error) {
    console.error("Customers list error", error);
    return NextResponse.json({ error: "Unable to load customers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { emails, subject, heading, body, ctaLabel, ctaHref } = await request.json();
    const list = Array.isArray(emails) ? emails.filter((e) => typeof e === "string" && e.includes("@")) : [];

    if (!list.length) return NextResponse.json({ error: "No recipients selected." }, { status: 400 });
    if (!subject || !heading || !Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Subject, heading and body are required." }, { status: 400 });
    }
    // A blast is hard to take back. Capped so a mistake cannot reach the whole
    // list in one click.
    if (list.length > 200) {
      return NextResponse.json({ error: "Send to at most 200 people at a time." }, { status: 400 });
    }

    let sent = 0;
    const failed: string[] = [];
    for (const to of list) {
      // Sent individually so recipients never see each other's addresses.
      const result = await sendEmail({ to, subject, heading, body, ctaLabel, ctaHref });
      if (result.ok) sent += 1;
      else failed.push(to);
    }

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    console.error("Broadcast error", error);
    return NextResponse.json({ error: "The broadcast could not be sent." }, { status: 500 });
  }
}
