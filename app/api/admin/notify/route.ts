import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

const COPY: Record<string, { subject: string; heading: string; body: (name: string, n: string) => string[] }> = {
  ready: {
    subject: "Your Palate order is ready",
    heading: "Your order is ready.",
    body: (name, n) => [
      `Hi ${name},`,
      `Order #${n} is packed and ready for pickup.`,
      `If you're running late, let us know and we'll keep it aside.`,
    ],
  },
  out_for_delivery: {
    subject: "Your Palate order is on its way",
    heading: "On its way.",
    body: (name, n) => [
      `Hi ${name},`,
      `Order #${n} has left us and is on its way to you.`,
      `Please make sure someone can take it in.`,
    ],
  },
};

/** Accepts 14:00 and 9:30 alike; anything else is refused rather than guessed. */
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * The delivery-window message, for a vanload at a time.
 *
 * Built as its own shape rather than another entry in COPY because it is the
 * only message that carries information typed at the moment of sending — the
 * two times — and the only one addressed to many orders at once.
 *
 * Each order is sent separately and its outcome recorded separately. A bulk
 * send that failed as a unit would be the worst possible behaviour here: one
 * bad address among thirty would leave the other twenty-nine customers with no
 * idea their food is on the way, on the one day the timing matters.
 */
export function deliveryWindowMessage(name: string, orderNumber: string, from: string, to: string) {
  return {
    subject: `Your Palate order #${orderNumber} is on its way`,
    heading: "Your order is on its way.",
    body: [
      `Hi ${name},`,
      `Your order is ready and is going out for delivery now. The expected delivery window is ${from}–${to}.`,
      `Thanks so much for the business!`,
      `Maya Apter`,
      `Palate Catering`,
    ],
  };
}

async function deliveryWindow(body: Record<string, unknown>) {
  const from = String(body.from || "").trim();
  const to = String(body.to || "").trim();
  if (!TIME.test(from) || !TIME.test(to)) {
    return NextResponse.json({ error: "Enter a start and end time, like 14:00 and 16:00." }, { status: 400 });
  }

  const ids = Array.isArray(body.orderIds)
    ? [...new Set(body.orderIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))].slice(0, 200)
    : [];
  if (!ids.length) return NextResponse.json({ error: "Select at least one order." }, { status: 400 });

  const { rows } = await sql.query(
    `SELECT id, order_number, customer_name, customer_email
     FROM orders WHERE id = ANY($1::int[]) AND COALESCE(is_deleted,false) = false`,
    [ids],
  );

  const sent: number[] = [];
  const failed: { orderNumber: string; name: string; error: string }[] = [];

  for (const order of rows) {
    const name = String(order.customer_name || "").trim().split(/\s+/)[0] || "there";
    const label = String(order.order_number);
    if (!order.customer_email) {
      failed.push({ orderNumber: label, name, error: "No email address on this order" });
      continue;
    }
    const message = deliveryWindowMessage(name, label, from, to);
    const result = await sendEmail({ to: String(order.customer_email), ...message });
    if (result.ok) sent.push(Number(order.id));
    else failed.push({ orderNumber: label, name, error: result.error || "Send failed" });
  }

  return NextResponse.json({ ok: true, sent: sent.length, sentIds: sent, failed });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "deliveryWindow") return await deliveryWindow(body);
    const { orderId, kind } = body;
    const template = COPY[String(kind)];
    if (!orderId || !template) {
      return NextResponse.json({ error: "orderId and a known kind are required." }, { status: 400 });
    }

    const { rows } = await sql`
      SELECT order_number, customer_name, customer_email
      FROM orders WHERE id = ${Number(orderId)} LIMIT 1;
    `;
    const order = rows[0];
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (!order.customer_email) {
      return NextResponse.json({ error: "That order has no email address." }, { status: 400 });
    }

    const name = String(order.customer_name || "").trim().split(/\s+/)[0] || "there";
    const result = await sendEmail({
      to: String(order.customer_email),
      subject: template.subject,
      heading: template.heading,
      body: template.body(name, String(order.order_number)),
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notify error", error);
    return NextResponse.json({ error: "Could not send that message." }, { status: 500 });
  }
}
