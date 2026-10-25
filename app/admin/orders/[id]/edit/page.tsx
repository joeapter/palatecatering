import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { ManualOrder, type ExistingOrder } from "@/components/admin/manual-order";

export const dynamic = "force-dynamic";

/**
 * Editing an order that was taken by hand.
 *
 * The same form the order was taken on, filled in with what was saved — a quote
 * that changes is the ordinary case, not the exception, and the alternative was
 * deleting the order and typing it again under a new number.
 */
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const { rows } = await sql`
    SELECT id, order_number, customer_name, customer_email, customer_phone, customer_address,
           allergies, total, items, status, payment_method, is_manual, order_window_id,
           pending_payment_url
    FROM orders
    WHERE id = ${orderId} AND COALESCE(is_deleted, false) = false
    LIMIT 1;
  `;
  const order = rows[0];
  if (!order) notFound();

  // Storefront orders are not editable: money has already been taken against
  // the exact basket that was charged for. Said plainly rather than hidden, so
  // nobody wonders where the edit button went.
  if (!order.is_manual) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
        <h1 className="display t-h2 font-semibold">Order #{order.order_number}</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          This order was placed and paid through the website, so its items cannot be edited here —
          the payment was taken against exactly this basket. Change it by refunding or by taking a
          new order, and leave a note on the original so the two can be matched up.
        </p>
        <Link href="/admin/orders" className="focus-ring mt-6 inline-block rounded-full border-2 border-ink px-5 py-3 text-xs font-bold">
          Back to orders
        </Link>
      </main>
    );
  }

  let windows: { id: number; name: string; eventType: string | null }[] = [];
  try {
    const result = await sql`
      SELECT id, name, event_type FROM order_windows
      WHERE active = true AND cutoff_at > now() - interval '7 days'
      ORDER BY event_date ASC LIMIT 12;
    `;
    windows = result.rows.map((row) => ({ id: row.id, name: row.name, eventType: row.event_type ?? null }));
  } catch {
    windows = [];
  }

  // The window this order was taken for may have closed since. It still has to
  // be selectable, or re-saving the order would silently move it to another week.
  if (order.order_window_id && !windows.some((w) => w.id === order.order_window_id)) {
    const past = await sql`SELECT id, name, event_type FROM order_windows WHERE id = ${order.order_window_id} LIMIT 1;`;
    if (past.rows[0]) {
      windows = [{ id: past.rows[0].id, name: past.rows[0].name, eventType: past.rows[0].event_type ?? null }, ...windows];
    }
  }

  const existing: ExistingOrder = {
    id: Number(order.id),
    orderNumber: Number(order.order_number),
    customer: {
      name: order.customer_name || "",
      phone: order.customer_phone || "",
      email: order.customer_email || "",
      address: order.customer_address || "",
    },
    orderWindowId: order.order_window_id ? String(order.order_window_id) : "",
    paymentMethod: order.payment_method || "unpaid",
    notes: order.allergies || "",
    status: order.status || "",
    hasPaymentLink: Boolean(order.pending_payment_url),
    items: (Array.isArray(order.items) ? order.items : []).map((item: Record<string, unknown>) => ({
      productId: item.productId ? Number(item.productId) : undefined,
      variantId: item.variantId ? Number(item.variantId) : undefined,
      title: String(item.title || ""),
      unitLabel: String(item.soldBy || item.unitLabel || ""),
      unitPrice: Number(item.price ?? item.unitPrice ?? 0) || 0,
      quantity: Number(item.quantity ?? 1) || 1,
      note: String(item.note || ""),
    })),
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Edit order #{order.order_number}</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Change the dishes, the week, the notes or how it was paid. The order keeps its number, so
        the customer is still holding the right one. If a payment link was already sent and the
        total changes, that link stops working and you send a new one.
      </p>
      <div className="mt-8">
        <ManualOrder windows={windows} existing={existing} />
      </div>
    </main>
  );
}
