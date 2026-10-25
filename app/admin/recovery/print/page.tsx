import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { PrintButton } from "../../orders/print/print-button";

type Item = {
  title?: string;
  quantity?: number;
  unitPrice?: number | string;
  variantLabel?: string;
  unitLabel?: string;
  productId?: number;
};

type Basket = {
  id: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_type: string | null;
  total: string | null;
  items: Item[];
  notes: string | null;
  last_seen_at: string;
  window_name: string | null;
  cutoff_at: string | null;
};

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

/**
 * A basket on paper.
 *
 * Deliberately headed "Basket", not "Invoice". Nothing here has been ordered:
 * the customer filled it and left, and the prices are the ones she saw at the
 * time. Converting it re-prices every line from the catalogue, so this sheet is
 * for reading and agreeing over the phone — the invoice comes from the order.
 */
export default async function BasketPrintPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id = "" } = await searchParams;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    return <main className="p-10"><p>No basket selected.</p></main>;
  }

  const { rows } = await sql<Basket>`
    SELECT ac.id, ac.status, ac.customer_name, ac.customer_email, ac.customer_phone,
           ac.customer_address, ac.delivery_type, ac.total, ac.items, ac.notes,
           ac.last_seen_at, ow.name AS window_name, ow.cutoff_at
    FROM abandoned_carts ac
    LEFT JOIN order_windows ow ON ow.id = ac.order_window_id
    WHERE ac.id = ${id}
    LIMIT 1;
  `;
  const basket = rows[0];
  if (!basket) return <main className="p-10"><p>That basket no longer exists.</p></main>;

  const items = Array.isArray(basket.items) ? basket.items : [];
  const total = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * (Number(item.quantity) || 1), 0);

  return (
    <main className="mx-auto w-full max-w-[194mm] bg-white p-4 text-black sm:p-6">
      <div className="no-print mb-8 flex items-center justify-between border-b pb-5">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase">Palate admin</p>
          <h1 className="display text-4xl font-semibold">Basket</h1>
          <p className="text-sm text-black/60">Not an order yet — prices as the customer saw them.</p>
        </div>
        <PrintButton />
      </div>

      <section className="print-sheet">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/20 pb-3">
          <div>
            <h2 className="display text-2xl font-semibold">{basket.customer_name || "No name given"}</h2>
            <p className="text-sm">{basket.window_name || "No date chosen"}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Basket · not paid</p>
            <p>Last seen {new Date(basket.last_seen_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2"><dt className="font-bold">Phone</dt><dd>{basket.customer_phone || "—"}</dd></div>
          <div className="flex gap-2"><dt className="font-bold">Email</dt><dd>{basket.customer_email || "—"}</dd></div>
          <div className="flex gap-2"><dt className="font-bold">How</dt><dd>{basket.delivery_type === "delivery" ? "Delivery" : basket.delivery_type === "pickup" ? "Pickup" : "—"}</dd></div>
          <div className="flex gap-2"><dt className="font-bold">Address</dt><dd>{basket.customer_address || "—"}</dd></div>
        </dl>

        {basket.notes && (
          <p className="mt-4 border border-black/20 p-3 text-sm"><b>Notes:</b> {basket.notes}</p>
        )}

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2">Unit</th>
              <th className="py-2 pr-2 text-right">Price</th>
              <th className="py-2 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const quantity = Number(item.quantity) || 1;
              const price = Number(item.unitPrice) || 0;
              return (
                <tr key={index} className="border-b border-black/10 align-top">
                  <td className="py-2 pr-2 tabular-nums">{quantity}</td>
                  <td className="py-2 pr-2">{item.title || "—"}</td>
                  <td className="py-2 pr-2">{item.variantLabel || item.unitLabel || ""}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{money(price)}</td>
                  <td className="py-2 text-right tabular-nums">{money(price * quantity)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={4} className="py-3 text-right font-bold">Total</td>
              <td className="py-3 text-right text-lg font-bold tabular-nums">{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4 text-xs text-black/60">
          Basket {basket.id}. Prices are those shown when the basket was filled; converting it to an
          order re-prices every line from the current catalogue.
        </p>
      </section>

      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          header, footer, .no-print { display: none !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          main { padding: 0 !important; max-width: none !important; }
          .print-sheet { break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
