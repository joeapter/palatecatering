"use client";

import { useEffect, useState } from "react";

type Cart = {
  id: string; status: string; customer_name: string | null; customer_email: string | null;
  total: string | null; item_count: number; reminders_sent: number;
  last_reminder_stage: string | null; last_reminder_at: string | null; last_seen_at: string;
  reminder_stop_reason: string | null; unsubscribed_at: string | null;
  window_name: string | null; cutoff_at: string | null;
  order_id: number | null; converted_order_number: number | null;
};
type StageRow = { stage: string; sent: number; recovered: number; failed: number };

type BasketItem = {
  title?: string; quantity?: number; unitPrice?: number | string;
  variantLabel?: string; unitLabel?: string; productId?: number;
};
type Basket = Cart & {
  customer_phone: string | null; customer_address: string | null;
  delivery_type: string | null; items: BasketItem[]; notes: string | null;
  allergies: string | null; shabbos_label: string | null;
  order_window_id: number | null; window_open: boolean | null; page_url: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  first: "1 · An hour later",
  second: "2 · Next day",
  last_call: "3 · Closes tonight",
};

/**
 * The same list the hand-order screen offers, so a basket taken over the phone
 * is recorded the same way as any other order rather than in its own vocabulary.
 */
const PAYMENT_METHODS = [
  { value: "unpaid", label: "Not paid yet" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "bit", label: "Bit" },
  { value: "zelle", label: "Zelle" },
  { value: "card_in_person", label: "Card in person" },
];

function money(value: unknown) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CartRecoveryBoard() {
  const [data, setData] = useState<{ carts: Cart[]; totals: Record<string, unknown>; byStage: StageRow[]; attributed: Record<string, unknown> } | null>(null);
  const [running, setRunning] = useState("");
  const [note, setNote] = useState("");
  const [basket, setBasket] = useState<Basket | null>(null);
  const [opening, setOpening] = useState("");

  async function load() {
    const response = await fetch("/api/admin/cart-recovery");
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { load(); }, []);

  /** Items are fetched per basket, so the list itself stays small. */
  async function open(id: string) {
    setOpening(id); setNote("");
    try {
      const response = await fetch(`/api/admin/cart-recovery?cart=${encodeURIComponent(id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That basket could not be opened.");
      setBasket(result.cart);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That basket could not be opened.");
    } finally {
      setOpening("");
    }
  }

  /** Preview first. Sending real email from a button needs a look before a leap. */
  async function sweep(dry: boolean) {
    setRunning(dry ? "dry" : "send"); setNote("");
    try {
      const response = await fetch(`/api/cron/cart-reminders${dry ? "?dry=1" : ""}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The sweep failed.");
      setNote(dry
        ? `${result.planned.length} reminder(s) would go out now, from ${result.considered} live basket(s).`
        : `Sent ${result.sent} reminder(s).${result.failures?.length ? ` ${result.failures.length} failed.` : ""}`);
      if (!dry) await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The sweep failed.");
    } finally {
      setRunning("");
    }
  }

  /** Opens a real SMTP session so a revoked app password shows up here, not in a lost reminder. */
  async function checkMail() {
    setRunning("mail"); setNote("");
    try {
      const result = await fetch("/api/admin/mail-test").then((r) => r.json());
      setNote(result.ok
        ? `Email is working — signed in as ${result.user}. Links will point at ${result.linkBase}.${result.linkBaseLooksRight ? "" : " ⚠️ That is not your domain."}`
        : `Email is NOT working: ${result.error}`);
    } catch {
      setNote("Could not check email.");
    } finally {
      setRunning("");
    }
  }

  if (!data) return <p className="text-sm text-ink/55">Loading…</p>;

  const totals = data.totals as Record<string, string | number>;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Live baskets" value={String(totals.live_carts ?? 0)} sub={`${money(totals.live_value)} sitting unpaid`} />
        <Stat label="Recovered by email" value={String(data.attributed.recovered_count ?? 0)} sub={`${money(data.attributed.recovered_value)} earned back`} />
        <Stat label="Recovered in total" value={String(totals.recovered_carts ?? 0)} sub="Includes people who came back unprompted" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => sweep(true)} disabled={Boolean(running)} className="rounded-full border border-ink/20 px-5 py-3 text-xs font-bold disabled:opacity-50">
          {running === "dry" ? "Checking…" : "Preview what would send"}
        </button>
        <button onClick={() => sweep(false)} disabled={Boolean(running)} className="rounded-full bg-ink px-5 py-3 text-xs font-bold text-white disabled:opacity-50">
          {running === "send" ? "Sending…" : "Send due reminders now"}
        </button>
        <button onClick={checkMail} disabled={Boolean(running)} className="rounded-full border border-ink/20 px-5 py-3 text-xs font-bold disabled:opacity-50">
          {running === "mail" ? "Checking…" : "Check email is working"}
        </button>
        <span className="text-xs text-ink/60">Runs automatically each morning around 10:00.</span>
      </div>
      {note && <p className="mt-3 text-sm font-semibold">{note}</p>}

      <h2 className="mt-10 text-xs font-bold tracking-[.18em] text-clay uppercase">By stage</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {["first", "second", "last_call"].map((stage) => {
          const row = data.byStage.find((s) => s.stage === stage);
          const sent = row?.sent ?? 0;
          const recovered = row?.recovered ?? 0;
          return (
            <div key={stage} className="rounded-2xl border border-ink/10 bg-white p-5">
              <p className="text-xs font-bold text-ink/55">{STAGE_LABEL[stage]}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{recovered}<span className="text-sm font-semibold text-ink/45"> / {sent}</span></p>
              <p className="mt-1 text-xs text-ink/55">
                recovered of sent{sent > 0 ? ` · ${Math.round((recovered / sent) * 100)}%` : ""}
                {row?.failed ? ` · ${row.failed} failed` : ""}
              </p>
              <a
                href={`/api/admin/cart-recovery/preview?stage=${stage}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-bold underline underline-offset-4"
              >
                Preview this email
              </a>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-xs font-bold tracking-[.18em] text-clay uppercase">Baskets</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-left text-xs text-ink/50">
            <tr>
              <th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">For</th>
              <th className="py-2 pr-3 text-right">Value</th><th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Reminders</th><th className="py-2 pr-3">Last seen</th>
              <th className="py-2 text-right">Basket</th>
            </tr>
          </thead>
          <tbody>
            {data.carts.map((cart) => (
              <tr key={cart.id} className="border-t border-ink/10 align-top">
                <td className="py-3 pr-3">
                  <p className="font-semibold">{cart.customer_name || "—"}</p>
                  <p className="text-xs text-ink/55">{cart.customer_email || "no email — cannot be mailed"}</p>
                </td>
                <td className="py-3 pr-3 text-xs">{cart.window_name || "—"}</td>
                <td className="py-3 pr-3 text-right font-semibold tabular-nums">{money(cart.total)}</td>
                <td className="py-3 pr-3">
                  <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">{cart.status}</span>
                  {cart.reminder_stop_reason && <p className="mt-1 text-[10px] text-ink/45">stopped: {cart.reminder_stop_reason}</p>}
                </td>
                <td className="py-3 pr-3 text-xs">
                  {cart.reminders_sent}{cart.last_reminder_stage ? ` · ${cart.last_reminder_stage}` : ""}
                  {cart.unsubscribed_at && <p className="text-[10px] text-clay">unsubscribed</p>}
                </td>
                <td className="py-3 pr-3 text-xs text-ink/55">{when(cart.last_seen_at)}</td>
                <td className="py-3 text-right">
                  {cart.converted_order_number ? (
                    <a href={`/admin/orders/${cart.order_id}/edit`} className="text-xs font-bold underline underline-offset-4">
                      #{cart.converted_order_number}
                    </a>
                  ) : (
                    <button
                      onClick={() => open(cart.id)}
                      disabled={Boolean(opening)}
                      className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                    >
                      {opening === cart.id ? "Opening…" : "Open"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.carts.length === 0 && <p className="py-6 text-sm text-ink/55">No baskets recorded yet.</p>}
      </div>

      {basket && (
        <BasketPanel
          basket={basket}
          onClose={() => setBasket(null)}
          onConverted={() => { setBasket(null); load(); }}
        />
      )}
    </div>
  );
}

/**
 * One basket, opened.
 *
 * The point of it is the two things that could not be done before: read what
 * she actually chose, and turn it into an order without retyping thirteen
 * dishes. Payment method is asked for up front because the reason a basket ends
 * up here is usually that the customer wants to pay by a means the website does
 * not take.
 */
function BasketPanel({ basket, onClose, onConverted }: { basket: Basket; onClose: () => void; onConverted: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: number; orderNumber: number; total: number } | null>(null);

  const items = Array.isArray(basket.items) ? basket.items : [];
  const savedTotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * (Number(item.quantity) || 1), 0);

  async function convert() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/manual-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "fromCart", cartId: basket.id, paymentMethod }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That basket could not be converted.");
      setDone({ id: result.id, orderNumber: result.orderNumber, total: result.total });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That basket could not be converted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="display text-2xl font-semibold">{basket.customer_name || "No name given"}</h3>
            <p className="mt-1 text-sm text-ink/60">{basket.window_name || "No date chosen"}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl">×</button>
        </div>

        {done ? (
          <div className="mt-6 rounded-2xl border border-ink/15 bg-cream p-5">
            <p className="text-sm font-bold">Order #{done.orderNumber} created · {money(done.total)}</p>
            <p className="mt-1 text-xs text-ink/60">
              {paymentMethod === "unpaid"
                ? "Held as awaiting payment, so the kitchen will not cook it yet."
                : `Recorded as paid by ${PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label.toLowerCase()}.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/admin/orders/${done.id}/edit`} className="rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white">Open the order</a>
              <a href={`/admin/orders/print?mode=invoice&ids=${done.id}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-5 py-2.5 text-xs font-bold">Print invoice</a>
              <button onClick={onConverted} className="rounded-full border border-ink/20 px-5 py-2.5 text-xs font-bold">Back to baskets</button>
            </div>
          </div>
        ) : (
          <>
            <dl className="mt-5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><dt className="font-bold">Phone</dt><dd>{basket.customer_phone || "—"}</dd></div>
              <div className="flex gap-2"><dt className="font-bold">Email</dt><dd className="break-all">{basket.customer_email || "—"}</dd></div>
              <div className="flex gap-2"><dt className="font-bold">How</dt><dd>{basket.delivery_type === "delivery" ? "Delivery" : basket.delivery_type === "pickup" ? "Pickup" : "—"}</dd></div>
              <div className="flex gap-2"><dt className="font-bold">Address</dt><dd>{basket.customer_address || "—"}</dd></div>
            </dl>

            {basket.notes && <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-sm"><b>Notes:</b> {basket.notes}</p>}

            <table className="mt-5 w-full text-sm">
              <thead className="text-left text-xs text-ink/50">
                <tr><th className="py-2 pr-2">Qty</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">Unit</th><th className="py-2 text-right">Line</th></tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const quantity = Number(item.quantity) || 1;
                  const price = Number(item.unitPrice) || 0;
                  return (
                    <tr key={index} className="border-t border-ink/10 align-top">
                      <td className="py-2 pr-2 tabular-nums">{quantity}</td>
                      <td className="py-2 pr-2">{item.title || "—"}</td>
                      <td className="py-2 pr-2 text-xs text-ink/55">{item.variantLabel || item.unitLabel || ""}</td>
                      <td className="py-2 text-right tabular-nums">{money(price * quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/20"><td colSpan={3} className="py-3 text-right font-bold">Basket total</td><td className="py-3 text-right font-bold tabular-nums">{money(savedTotal)}</td></tr>
              </tfoot>
            </table>

            <p className="mt-3 text-xs leading-5 text-ink/55">
              Prices above are the ones she saw. Converting re-prices every line from the current
              catalogue, so the order total can differ if a price has changed since.
              {basket.window_open === false && " Her chosen date has already closed — pick the window again on the order if it needs to move."}
            </p>

            <div className="mt-6 border-t border-ink/10 pt-5">
              <label className="block text-xs font-bold uppercase">How is she paying?
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-base font-medium normal-case sm:text-sm"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </label>

              {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={convert} disabled={busy || !items.length} className="rounded-full bg-ink px-5 py-3 text-xs font-bold text-white disabled:opacity-50">
                  {busy ? "Converting…" : "Convert to an order"}
                </button>
                <a href={`/admin/recovery/print?id=${encodeURIComponent(basket.id)}`} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-5 py-3 text-xs font-bold">
                  Print basket
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <p className="text-xs font-bold tracking-wider text-ink/50 uppercase">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink/55">{sub}</p>
    </div>
  );
}
