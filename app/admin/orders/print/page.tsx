import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { isKitchen } from "@/lib/kitchen-session";
import { PrintButton } from "./print-button";
import { FitToPage } from "./fit-to-page";
import { BackFromPrint } from "./back-from-print";

type Item = { title?: string; quantity?: number; soldBy?: string; note?: string; price?: number | string; unitPrice?: number | string; unit_price?: number | string };
type PrintOrder = { id: number; order_number: number; created_at: string; updated_at?: string | null; revision?: number | null; customer_name: string; customer_email: string; customer_phone: string; customer_address: string; shabbos_label: string; allergies: string; total: string; items: Item[]; payment_method?: string | null; is_manual?: boolean; status?: string };

export const dynamic = "force-dynamic";

export default async function BulkPrintPage({ searchParams }: { searchParams: Promise<{ mode?: string; ids?: string }> }) {
  // The kitchen screen prints these same sheets, so kitchen sign-in is enough.
  // They contain no pricing in kitchen and driver modes, which is why the
  // kitchen can be trusted with them without being trusted with the admin.
  const [admin, kitchen] = await Promise.all([isAdmin(), isKitchen()]);
  if (!admin && !kitchen) redirect("/kitchen");
  const params = await searchParams; const mode = params.mode === "driver" ? "driver" : params.mode === "order" ? "order" : params.mode === "cooklist" ? "cooklist" : params.mode === "invoice" ? "invoice" : "kitchen";
  const ids = [...new Set(String(params.ids || "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 300);
  if (!ids.length) return <main className="p-10"><p>No orders selected.</p></main>;
  // A revised quote and the one it replaced look identical on paper unless the
  // sheet says which is which, so the revision travels with it. Selected
  // defensively: migration 0025 adds these two columns.
  const result = await sql.query<PrintOrder>(`SELECT id, order_number, created_at, customer_name, customer_email, customer_phone, customer_address, shabbos_label, allergies, total, items, payment_method, is_manual, status, to_jsonb(orders.*) ->> 'updated_at' AS updated_at, (to_jsonb(orders.*) ->> 'revision')::int AS revision FROM orders WHERE id = ANY($1::int[]) AND COALESCE(is_deleted,false) = false ORDER BY customer_address NULLS LAST, order_number`, [ids]);
  const orders = result.rows;
  const heading = mode === "kitchen" ? "Kitchen packet" : mode === "driver" ? "Driver packet" : mode === "cooklist" ? "Cook list" : mode === "invoice" ? "Invoice" : "Customer order";
  return <main className="mx-auto w-full max-w-[194mm] bg-white p-4 text-black sm:p-6"><FitToPage /><div className="no-print mb-8 flex items-center justify-between border-b pb-5"><div><p className="text-xs font-bold tracking-widest uppercase">Palate admin</p><h1 className="display text-4xl font-semibold">{heading}</h1>{/* Deliberately says nothing about pricing. Whether a sheet carries
                prices is the owner's decision and not something to announce to
                whoever is holding the printout. */}
            <p className="text-sm text-black/60">{orders.length} selected order{orders.length === 1 ? "" : "s"}</p></div><div className="flex shrink-0 items-center gap-2"><BackFromPrint /><PrintButton /></div></div>{mode === "cooklist" ? <CookList orders={orders} /> : mode === "invoice" ? orders.map((order) => <Invoice key={order.id} order={order} />) : orders.map((order) => mode === "kitchen" ? <KitchenSheet key={order.id} order={order} /> : mode === "driver" ? <DriverSheet key={order.id} order={order} /> : <OrderReceipt key={order.id} order={order} />)}<style>{`
      @page { size: A4 portrait; margin: 8mm; }
      @media print {
        header, footer, .no-print { display: none !important; }
        html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        main { padding: 0 !important; max-width: none !important; }
        /* Every sheet is its own page, and the last one must not ask for
           another — that trailing break is what produced a blank page two. */
        .print-sheet { break-after: page; page-break-after: always; break-inside: avoid; min-height: 0 !important; }
        /* :last-of-type, not :last-child. The stylesheet element below is the
           parent's last child, so :last-child matched no sheet at all and every
           sheet kept its page break — that is the blank trailing page. */
        .print-sheet:last-of-type { break-after: auto !important; page-break-after: auto !important; }
        /* Tighten the table so a long order has room to stay on one page
           before the type has to shrink at all. */
        .print-sheet table { font-size: inherit; }
        .print-sheet td, .print-sheet th { padding-top: .35em !important; padding-bottom: .35em !important; }
      }
    `}</style></main>;
}

/** "Revised 15 Sep · v2", or nothing at all for an order never edited. */
function revisionLabel(order: PrintOrder) {
  const revision = Number(order.revision) || 0;
  if (!revision || !order.updated_at) return "";
  return `Revised ${new Date(order.updated_at).toLocaleDateString("en-GB", { dateStyle: "medium" })} · v${revision + 1}`;
}

function money(value: number | string | undefined) { const amount = Number(String(value ?? "0").replace(/[^0-9.-]/g, "")); return `₪${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`; }
function itemUnitPrice(item: Item) { return item.unitPrice ?? item.unit_price ?? item.price ?? 0; }

function OrderReceipt({ order }: { order: PrintOrder }) { return <section className="print-sheet py-4"><div className="flex justify-between border-b-2 border-black pb-4"><div><p className="text-xs font-bold tracking-widest uppercase">Palate Catering</p><h2 className="mt-1 text-3xl font-bold">Order #{order.order_number}</h2><p className="mt-1 text-sm">{new Date(order.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p></div><div className="text-right"><p className="font-bold">{order.shabbos_label || "Order"}</p><p className="text-sm">{order.customer_name || "Guest"}</p>{revisionLabel(order) && <p className="text-xs font-bold">{revisionLabel(order)}</p>}</div></div><div className="mt-6 grid gap-2 sm:grid-cols-2"><p><b>Customer:</b> {order.customer_name || "Guest"}</p><p><b>Phone:</b> {order.customer_phone || "Not provided"}</p><p><b>Email:</b> {order.customer_email || "Not provided"}</p><p><b>Address:</b> {order.customer_address || "Pickup"}</p></div>{order.allergies && <div className="mt-5 border border-black p-3"><b>Allergies / notes:</b> {order.allergies}</div>}<table className="mt-7 w-full border-collapse"><thead><tr className="border-b-2 border-black text-left text-xs uppercase"><th className="py-3">Item</th><th className="py-3">Size</th><th className="py-3 text-right">Qty</th><th className="py-3 text-right">Unit price</th><th className="py-3 text-right">Line total</th></tr></thead><tbody>{(order.items || []).map((item, index) => { const qty = Number(item.quantity) || 1; const price = Number(String(itemUnitPrice(item)).replace(/[^0-9.-]/g, "")) || 0; return <tr key={index} className="border-b border-black/30"><td className="py-4 font-semibold">{item.title || "Item"}{item.note && <span className="block text-sm font-normal italic">{item.note}</span>}</td><td className="py-4">{item.soldBy || "—"}</td><td className="py-4 text-right">{qty}</td><td className="py-4 text-right">{money(price)}</td><td className="py-4 text-right font-semibold">{money(price * qty)}</td></tr>; })}</tbody></table><div className="mt-6 flex justify-end"><p className="border-t-2 border-black px-4 pt-4 text-2xl font-bold">Total: {money(order.total)}</p></div></section>; }

function KitchenSheet({ order }: { order: PrintOrder }) { return <section className="print-sheet py-4"><div className="flex justify-between border-b-2 border-black pb-4"><div><p className="text-xs font-bold tracking-widest uppercase">Kitchen prep</p><h2 className="mt-1 text-3xl font-bold">Order #{order.order_number}</h2></div><div className="text-right"><p className="font-bold">{order.customer_name || "Guest"}</p><p className="text-sm">{order.shabbos_label}</p>{revisionLabel(order) && <p className="text-xs font-bold">{revisionLabel(order)}</p>}</div></div>{order.allergies && <div className="mt-5 border-2 border-black p-4 text-lg font-bold">ALLERGIES / NOTES: {order.allergies}</div>}<table className="mt-6 w-full border-collapse text-lg"><thead><tr className="border-b-2 border-black text-left text-xs uppercase"><th className="py-3">Item</th><th className="py-3">Size</th><th className="py-3 text-right">Qty</th></tr></thead><tbody>{(order.items || []).map((item, index) => <tr key={index} className="border-b border-black/30"><td className="py-4 font-semibold">{item.title || "Item"}{item.note && <span className="block text-base font-bold">→ {item.note}</span>}</td><td className="py-4">{item.soldBy || "—"}</td><td className="py-4 text-right text-2xl font-bold">{Number(item.quantity) || 1}</td></tr>)}</tbody></table></section>; }

function DriverSheet({ order }: { order: PrintOrder }) { return <section className="print-sheet py-4"><div className="flex justify-between border-b-2 border-black pb-4"><div><p className="text-xs font-bold tracking-widest uppercase">Packing / delivery</p><h2 className="mt-1 text-3xl font-bold">Order #{order.order_number}</h2></div><div className="h-8 w-8 border-2 border-black" aria-label="Delivery completed checkbox" /></div><div className="mt-6 grid gap-3 text-lg"><p><b>Customer:</b> {order.customer_name || "Guest"}</p><p><b>Phone:</b> {order.customer_phone || "Not provided"}</p><p><b>Address:</b> {order.customer_address || "Pickup"}</p><p><b>Order:</b> {order.shabbos_label || "—"}</p>{order.allergies && <p className="border-2 border-black p-3"><b>Notes:</b> {order.allergies}</p>}</div><h3 className="mt-8 border-b-2 border-black pb-2 text-xs font-bold tracking-widest uppercase">Packing checklist</h3><div>{(order.items || []).map((item, index) => <div key={index} className="flex items-center gap-4 border-b border-black/30 py-4"><span className="h-6 w-6 shrink-0 border-2 border-black" /><span className="flex-1 text-lg font-semibold">{Number(item.quantity) || 1} × {item.title || "Item"}{item.note && <span className="block text-sm font-normal italic">{item.note}</span>}</span><span>{item.soldBy || ""}</span></div>)}</div><div className="mt-10 grid grid-cols-2 gap-10"><p className="border-t border-black pt-2 text-sm">Driver initials</p><p className="border-t border-black pt-2 text-sm">Delivered at</p></div></section>; }

/**
 * One sheet totalling every dish across the selected orders.
 *
 * The per-order kitchen sheets answer "what goes in this box"; this answers
 * "how much do we cook today", which is the question the kitchen actually
 * starts the morning with. Aggregated by dish and size together, because two
 * pans of the same dish in different sizes are two different jobs.
 */
function CookList({ orders }: { orders: PrintOrder[] }) {
  const totals = new Map<string, { title: string; size: string; qty: number; orders: number; notes: string[] }>();
  for (const order of orders) {
    for (const item of order.items || []) {
      const title = item.title || "Item";
      const size = item.soldBy || "";
      const key = `${title}|||${size}`;
      const current = totals.get(key) || { title, size, qty: 0, orders: 0, notes: [] };
      current.qty += Number(item.quantity) || 0;
      current.orders += 1;
      // A note belongs to one order's portion, not to the whole batch, so it is
      // printed against the dish with the order number that asked for it.
      if (item.note) current.notes.push(`#${order.order_number}: ${item.note}`);
      totals.set(key, current);
    }
  }
  const rows = [...totals.values()].sort((a, b) => a.title.localeCompare(b.title) || a.size.localeCompare(b.size));
  const dishes = rows.length;
  const portions = rows.reduce((sum, row) => sum + row.qty, 0);

  const windows = [...new Set(orders.map((o) => o.shabbos_label).filter(Boolean))];
  const allergies = orders.filter((o) => o.allergies).map((o) => ({ number: o.order_number, note: o.allergies }));

  return (
    <section className="print-sheet py-4">
      <div className="flex items-end justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase">Cook list</p>
          <h2 className="mt-1 text-3xl font-bold">{portions} to make · {dishes} dishes</h2>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
          {windows.slice(0, 2).map((w) => <p key={w}>{w}</p>)}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase">
            <th className="py-2">Dish</th>
            <th className="py-2">Size</th>
            <th className="py-2 text-right">Make</th>
            <th className="py-2 text-center">Done</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.title}-${row.size}`} className="border-b border-black/30">
              <td className="py-2 font-semibold">{row.title}{row.notes.map((note) => <span key={note} className="block text-xs font-normal italic">{note}</span>)}</td>
              <td className="py-2">{row.size || "—"}</td>
              <td className="py-2 text-right text-xl font-bold tabular-nums">{row.qty}</td>
              {/* A tick box, because this sheet gets worked through rather than read. */}
              <td className="py-2 text-center"><span className="inline-block h-5 w-5 border-2 border-black" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {allergies.length > 0 && (
        <div className="mt-5 border-2 border-black p-3">
          <p className="text-xs font-bold tracking-widest uppercase">Allergies and notes</p>
          {allergies.map((a) => (
            <p key={a.number} className="mt-1 text-sm"><b>#{a.number}:</b> {a.note}</p>
          ))}
        </div>
      )}
    </section>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  bit: "Bit",
  bank_transfer: "Bank transfer",
  zelle: "Zelle",
  card_in_person: "Card in person",
  stripe: "Card online",
  unpaid: "Unpaid",
};

/**
 * An invoice a customer can be sent.
 *
 * Unlike the kitchen and driver sheets this is an outward-facing document, so
 * it carries the business's own details, itemised prices, and — the point of it
 * — how the order was paid. An unpaid order says so plainly rather than looking
 * like a receipt, because an invoice that implies payment was received when it
 * was not is worse than no invoice.
 */
function Invoice({ order }: { order: PrintOrder }) {
  const method = order.payment_method || "unpaid";
  const paid = method !== "unpaid";
  const label = PAYMENT_LABELS[method] || method;

  return (
    <section className="print-sheet py-4">
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase">Palate Catering</p>
          <p className="mt-1 text-sm">Beit Shemesh · 058-728-0062</p>
          <p className="text-sm">palatecateringisrael.com</p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold">{paid ? "Receipt" : "Invoice"}</h2>
          <p className="mt-1 text-sm">#{order.order_number}</p>
          <p className="text-sm">{new Date(order.created_at).toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
          {revisionLabel(order) && <p className="text-sm font-bold">{revisionLabel(order)}</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-1 text-sm sm:grid-cols-2">
        <p><b>Billed to:</b> {order.customer_name || "—"}</p>
        <p><b>Phone:</b> {order.customer_phone || "—"}</p>
        <p><b>Email:</b> {order.customer_email || "—"}</p>
        <p><b>For:</b> {order.shabbos_label || "—"}</p>
        {order.customer_address && <p className="sm:col-span-2"><b>Delivery:</b> {order.customer_address}</p>}
      </div>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase">
            <th className="py-2">Item</th>
            <th className="py-2">Size</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item, index) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(String(itemUnitPrice(item)).replace(/[^0-9.-]/g, "")) || 0;
            return (
              <tr key={index} className="border-b border-black/30">
                <td className="py-2 font-semibold">{item.title || "Item"}{item.note && <span className="block text-xs font-normal italic">{item.note}</span>}</td>
                <td className="py-2">{item.soldBy || "—"}</td>
                <td className="py-2 text-right">{qty}</td>
                <td className="py-2 text-right">{money(price)}</td>
                <td className="py-2 text-right font-semibold">{money(price * qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 flex justify-end">
        <div className="w-64">
          <div className="flex justify-between border-t-2 border-black pt-3 text-xl font-bold">
            <span>Total</span><span>{money(order.total)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span>{paid ? "Paid by" : "Payment"}</span>
            <b>{label}</b>
          </div>
        </div>
      </div>

      {!paid && (
        <p className="mt-5 border-2 border-black p-3 text-sm font-bold">
          This order has not been paid yet. Please settle before collection or delivery.
        </p>
      )}
      {order.allergies && <p className="mt-4 text-sm"><b>Notes:</b> {order.allergies}</p>}
      <p className="mt-6 text-xs text-black/60">Thank you — Palate Catering, Beit Shemesh.</p>
    </section>
  );
}
