"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContactActions } from "./contact-actions";
import { openPrintSheet } from "@/components/print-link";
import { whatsappLink } from "@/lib/notifications/messages";

type Scope = "active" | "delivered" | "dispatch";

/** Same shape the server insists on, so the button disables before a refusal. */
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * The message a customer gets, written once and used for both channels.
 *
 * Email and WhatsApp must say the same thing — a customer who gets both should
 * not find two different delivery windows — so the wording lives here and the
 * server builds the email from the same sentence.
 */
function deliveryMessage(name: string | null, from: string, to: string) {
  const first = String(name || "").trim().split(/\s+/)[0] || "there";
  return `Hi ${first},\n\nYour order is ready and is going out for delivery now. The expected delivery window is ${from || "[start]"}–${to || "[end]"}.\n\nThanks so much for the business!\n\nMaya Apter\nPalate Catering`;
}

/** Fulfilment lives in the window label; an order taken by hand may lack it. */
function fulfilment(label: string | null): "delivery" | "pickup" | "unknown" {
  const text = String(label || "").toLowerCase();
  if (text.includes("delivery")) return "delivery";
  if (text.includes("pickup")) return "pickup";
  return "unknown";
}

/**
 * Which town a delivery is going to.
 *
 * The storefront writes it into the window label as "… · Delivery to Jerusalem",
 * and it is the one thing a street address does not tell you at a glance — two
 * "Ha-Kayil St" are a forty minute drive apart if one is Jerusalem.
 */
function deliveryCity(label: string | null): string {
  const match = /delivery to\s+([^·]+)/i.exec(String(label || ""));
  return match ? match[1].trim() : "";
}

type Item = { title?: string; quantity?: number; bundleId?: number; soldBy?: string; note?: string };
type Order = {
  id: number;
  order_number: number;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  shabbos_label: string;
  total: string;
  items: Item[];
  allergies: string;
  is_manual?: boolean;
};
type Recovery = {
  paymentIntentId: string;
  status: string;
  paymentStatus: string;
  needsAction: boolean;
  amount: number;
  attempts: number;
  lastError: string | null;
  customerName: string;
  customerEmail: string;
};

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [windows, setWindows] = useState<{ id: number; name: string }[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [windowId, setWindowId] = useState("");
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"orders" | "kitchen" | "delivered" | "dispatch">("orders");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /**
   * No status is pre-chosen.
   *
   * This used to start on "ready", so selecting orders — to print, say — and
   * then touching "Change status" pushed every one of them to ready in a single
   * tap, with nothing asked and nothing to undo. That is the likeliest reason
   * orders appeared to move from new to ready on their own. The button is now
   * dead until a status is deliberately picked.
   */
  const [bulkStatus, setBulkStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ active: 0, delivered: 0, dispatch: 0 });

  /**
   * Which list is on screen. Totals is a different presentation of the working
   * orders, not a different set of them, so it shares the active fetch — the
   * archive and the dispatch run each ask the server for something else.
   */
  const scope: Scope = view === "delivered" ? "delivered" : view === "dispatch" ? "dispatch" : "active";

  const load = useCallback(async (wid: string, listScope: Scope) => {
    try {
      const query = new URLSearchParams();
      if (wid) query.set("windowId", wid);
      if (listScope !== "active") query.set("scope", listScope);
      const suffix = query.toString();
      const [o, r] = await Promise.all([
        fetch(`/api/admin/orders${suffix ? `?${suffix}` : ""}`).then((res) => res.json()),
        fetch("/api/admin/checkout-recovery").then((res) => res.json()).catch(() => ({ sessions: [] })),
      ]);
      if (o.error) throw new Error(o.error);
      setOrders(o.orders || []);
      setSelected(new Set());
      setWindows(o.windows || []);
      setStatuses(o.statuses || []);
      setCounts(o.counts || { active: 0, delivered: 0, dispatch: 0 });
      setRecovery((r.sessions || []).filter((s: Recovery) => s.needsAction));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(windowId, scope); }); }, [load, windowId, scope]);

  /** What the kitchen needs: totals per dish across every order in the window. */
  const kitchenTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items || []) {
        const name = `${item.title || "Item"}${item.soldBy ? ` · ${item.soldBy}` : ""}`;
        totals.set(name, (totals.get(name) || 0) + (Number(item.quantity) || 0));
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);

  async function setStatus(id: number, status: string) {
    await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "status", id, status }),
    });
    load(windowId, scope);
  }

  function toggleSelected(id: number) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function toggleAll() {
    setSelected((current) => current.size === orders.length ? new Set() : new Set(orders.map((order) => order.id)));
  }

  async function bulkAction(action: "bulkStatus" | "bulkDelete") {
    const ids = [...selected]; if (!ids.length) return;
    if (action === "bulkDelete" && !window.confirm(`Delete ${ids.length} selected order${ids.length === 1 ? "" : "s"}? They will be hidden but retained in the database.`)) return;
    // Every bulk status change is confirmed, not just "delivered". Moving a
    // dozen orders to the wrong status is the same size of mistake whichever
    // status it is, and it is the mistake that has actually been happening.
    if (action === "bulkStatus") {
      if (!bulkStatus) return;
      if (!window.confirm(`Change ${ids.length} selected order${ids.length === 1 ? "" : "s"} to "${bulkStatus}"?`)) return;
    }
    setBusy(true); setError("");
    const response = await fetch("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ids, status: bulkStatus }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(data.error || "Bulk action failed."); return; }
    await load(windowId, scope);
  }

  /**
   * Opens a printable sheet.
   *
   * Installed to a home screen there is no tab to open into, and iOS ignores
   * window.open silently — the button looked fine and did nothing. Navigate in
   * place there; the print page carries its own way back.
   */
  function printSelected(mode: "kitchen" | "driver" | "cooklist") {
    if (!selected.size) return;
    // window.open, always: this is what made printing work from the installed
    // admin, and navigating in place is what silently broke it.
    openPrintSheet(`/admin/orders/print?mode=${mode}&ids=${[...selected].join(",")}`);
  }

  async function retry(paymentIntentId: string) {
    const response = await fetch("/api/admin/checkout-recovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Retry failed.");
    load(windowId, scope);
  }

  if (loading) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div>
      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      )}

      {recovery.length > 0 && (
        <section className="mb-8 rounded-2xl border-2 border-red-600 bg-red-50 p-5">
          <h2 className="font-bold text-red-800">Paid, but no order was created</h2>
          <p className="mt-1 text-sm text-red-700">
            These customers were charged and nothing reached the kitchen. Retrying re-sends the
            order through the normal pipeline; it is safe to press more than once.
          </p>
          <ul className="mt-4 space-y-2">
            {recovery.map((session) => (
              <li key={session.paymentIntentId} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1">
                  <b>{session.customerName || session.customerEmail || "Unknown"}</b> · ₪
                  {session.amount.toFixed(2)} · {session.attempts} attempt
                  {session.attempts === 1 ? "" : "s"}
                  {session.lastError && (
                    <span className="block text-xs text-red-700/80">{session.lastError}</span>
                  )}
                </span>
                <button
                  onClick={() => retry(session.paymentIntentId)}
                  className="rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white"
                >
                  Retry now
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={windowId}
          onChange={(event) => setWindowId(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-white px-3 py-2.5 text-sm sm:flex-none"
        >
          <option value="">All recent orders</option>
          {windows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <div className="flex shrink-0 rounded-full bg-ink/5 p-1">
          {(["orders", "kitchen", "dispatch", "delivered"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded-full px-3 py-2 text-xs font-bold whitespace-nowrap ${view === mode ? "bg-ink text-white" : "text-ink/60"}`}
            >
              {mode === "orders" ? "To do"
                : mode === "kitchen" ? "Totals"
                : mode === "dispatch" ? `Dispatch${counts.dispatch ? ` ${counts.dispatch}` : ""}`
                : `Delivered${counts.delivered ? ` ${counts.delivered}` : ""}`}
            </button>
          ))}
        </div>

        <p className="w-full text-xs text-ink/55 sm:ml-auto sm:w-auto sm:text-sm">
          {orders.length} {view === "delivered" ? "delivered" : view === "dispatch" ? "going out" : "to do"}
        </p>
      </div>

      {view === "delivered" && (
        <p className="mb-4 rounded-xl bg-cream px-4 py-3 text-xs leading-5 text-ink/70">
          Orders marked delivered move here automatically. Nothing is deleted — set one back to
          another status and it returns to the working list.
        </p>
      )}

      {(view === "orders" || view === "delivered") && orders.length > 0 && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={selected.size === orders.length && orders.length > 0} onChange={toggleAll} className="size-5 accent-ink" />
              Select all
            </label>
            <span className="text-xs text-ink/50">{selected.size} selected</span>
          </div>

          {/* The actions only appear once something is selected. Five disabled
              buttons taking a third of a phone screen was noise. */}
          {selected.size > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} disabled={busy} className="rounded-xl border border-ink/20 px-3 py-2.5 text-xs font-semibold capitalize">
                <option value="">Change status to…</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button disabled={busy || !bulkStatus} onClick={() => bulkAction("bulkStatus")} className="rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-white disabled:opacity-35">Change status</button>
              <button disabled={busy} onClick={() => printSelected("cooklist")} className="rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold disabled:opacity-35">Cook list</button>
              <button disabled={busy} onClick={() => printSelected("kitchen")} className="rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold disabled:opacity-35">Print kitchen</button>
              <button disabled={busy} onClick={() => printSelected("driver")} className="rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold disabled:opacity-35">Print driver</button>
              <button disabled={busy} onClick={() => bulkAction("bulkDelete")} className="col-span-2 rounded-full border border-red-300 px-4 py-2.5 text-xs font-bold text-red-700 disabled:opacity-35 sm:col-span-1">Delete</button>
            </div>
          )}
        </div>
      )}

      {view === "dispatch" ? (
        <DispatchBoard
          orders={orders}
          selected={selected}
          toggle={toggleSelected}
          toggleAll={toggleAll}
          onSent={() => load(windowId, scope)}
        />
      ) : view === "kitchen" ? (
        <div className="rail overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-ink/10 text-left text-xs tracking-wider text-ink/50 uppercase">
              <tr><th className="px-5 py-3">Dish</th><th className="px-5 py-3 text-right">Total to make</th></tr>
            </thead>
            <tbody>
              {kitchenTotals.map(([name, qty]) => (
                <tr key={name} className="border-b border-ink/5 last:border-0">
                  <td className="px-5 py-3">{name}</td>
                  <td className="px-5 py-3 text-right text-lg font-bold tabular-nums">{qty}</td>
                </tr>
              ))}
              {kitchenTotals.length === 0 && (
                <tr><td className="px-5 py-6 text-ink/50" colSpan={2}>Nothing ordered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className={`rounded-2xl border bg-white p-4 sm:p-5 ${selected.has(order.id) ? "border-honey ring-2 ring-honey/25" : "border-ink/10"}`}>
              {/* Identity and money on one line — the two things being scanned
                  for. Everything else is detail underneath. */}
              <div className="flex items-start gap-3">
                {/* Padded so the tap area is a full 44px; a bare 20px checkbox
                    is the hardest thing on the row to hit. */}
                <label className="-m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center p-3">
                  <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelected(order.id)} aria-label={`Select order ${order.order_number}`} className="size-5 accent-ink" />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-bold">#{order.order_number} · {order.customer_name || "—"}</p>
                    <p className="shrink-0 text-lg font-bold tabular-nums">
                      ₪{Number(String(order.total || "0").replace(/[^0-9.]/g, "")).toFixed(0)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-ink/55">
                    {order.shabbos_label} · {new Date(order.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {order.customer_address && (
                    <p className="mt-1 text-xs text-ink/55">{order.customer_address}</p>
                  )}
                </div>
              </div>

              {order.allergies && (
                <p className="mt-3 rounded-lg bg-honey/25 px-3 py-2 text-xs font-semibold">
                  Allergies: {order.allergies}
                </p>
              )}

              <p className="mt-3 line-clamp-2 text-sm text-ink/70">
                {(order.items || []).map((item) => `${item.quantity ?? 1}× ${item.title ?? "Item"}${item.note ? ` (${item.note})` : ""}`).join(", ")}
              </p>

              {/* Reaching the customer is the most common thing done from a row,
                  so it gets the full width rather than a corner. */}
              <div className="mt-4">
                <ContactActions
                  order={{
                    orderNumber: order.order_number,
                    customerName: order.customer_name,
                    customerPhone: order.customer_phone,
                    total: order.total,
                    windowLabel: order.shabbos_label,
                    items: order.items,
                  }}
                />
              </div>

              <div className="mt-2 flex gap-2">
                <select
                  value={order.status}
                  onChange={(event) => setStatus(order.id, event.target.value)}
                  aria-label={`Status for order ${order.order_number}`}
                  className="h-11 min-w-0 flex-1 rounded-full border border-ink/20 px-3 text-xs font-semibold capitalize"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                {/* Only orders taken by hand can be edited — a storefront order
                    was paid against the basket it carries. */}
                {order.is_manual && (
                  <Link
                    href={`/admin/orders/${order.id}/edit`}
                    className="focus-ring flex h-11 shrink-0 items-center rounded-full border border-ink/20 px-4 text-xs font-bold"
                  >
                    Edit
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => openPrintSheet(`/admin/orders/print?mode=order&ids=${order.id}`)}
                  className="h-11 shrink-0 rounded-full border border-ink/20 px-4 text-xs font-bold"
                >
                  Print
                </button>
              </div>
            </article>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-ink/55">
              {view === "delivered"
                ? "Nothing delivered yet."
                : counts.delivered > 0
                  // Otherwise an empty list after a finished week reads as lost orders.
                  ? `Nothing left to do. All ${counts.delivered} order${counts.delivered === 1 ? "" : "s"} here are delivered — see the Delivered tab.`
                  : "No orders in this window."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Telling a van's worth of customers when their food is coming.
 *
 * Two times are typed once, at the top, and every message on the screen updates
 * to match — so whoever is sending reads the exact sentence the customer will
 * get before anything goes out, rather than trusting a template they cannot see.
 *
 * Both channels exist because neither is reliable alone. Email reaches everyone
 * at once but lands wherever the customer's provider decides; WhatsApp is the
 * channel this customer base actually reads, but it opens one chat at a time
 * from the sender's own phone. So: email in bulk, WhatsApp per order, same
 * words, and the result of every individual send reported rather than a count.
 */
function DispatchBoard({
  orders, selected, toggle, toggleAll, onSent,
}: {
  orders: Order[];
  selected: Set<number>;
  toggle: (id: number) => void;
  toggleAll: () => void;
  onSent: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: { orderNumber: string; name: string; error: string }[] } | null>(null);

  const timesValid = TIME.test(from) && TIME.test(to);
  const chosen = orders.filter((order) => selected.has(order.id));
  // Emailing an order with no address on file cannot work, so it is not offered
  // as if it might — the row says so and WhatsApp remains open to it.
  const emailable = chosen.filter((order) => order.customer_email);

  async function sendEmails() {
    if (!timesValid || !emailable.length) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deliveryWindow", orderIds: emailable.map((o) => o.id), from, to }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Those messages could not be sent.");
      setResult({ sent: data.sent ?? 0, failed: data.failed ?? [] });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those messages could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
        <h2 className="font-bold">Delivery window</h2>
        <p className="mt-1 text-xs leading-5 text-ink/60">
          Orders waiting to go out. Pickups are left off; each customer&rsquo;s name and order number
          fill in on their own.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase">From
            <input type="time" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-12 rounded-xl border border-ink/20 px-3 text-base font-medium" />
          </label>
          <label className="text-xs font-bold uppercase">To
            <input type="time" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-12 rounded-xl border border-ink/20 px-3 text-base font-medium" />
          </label>
          <button
            onClick={sendEmails}
            disabled={busy || !timesValid || !emailable.length}
            className="h-12 rounded-full bg-ink px-5 text-xs font-bold text-white disabled:opacity-35"
          >
            {busy ? "Sending…" : `Email ${emailable.length || ""} selected`}
          </button>
        </div>

        {/* The exact words that will go out, not a description of them. */}
        <pre className="mt-4 rounded-xl bg-cream p-4 text-xs leading-5 whitespace-pre-wrap">
          {deliveryMessage(chosen[0]?.customer_name ?? "Rivka", from, to)}
        </pre>

        {!timesValid && (from || to) && <p className="mt-2 text-xs font-semibold text-clay">Enter both times as HH:MM, like 14:00.</p>}
        {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}

        {result && (
          <div className="mt-3 rounded-xl bg-cream p-4 text-sm">
            <p className="font-bold">{result.sent} email{result.sent === 1 ? "" : "s"} sent.</p>
            {result.failed.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-red-800">{result.failed.length} could not be sent — message these by WhatsApp:</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {result.failed.map((f) => (
                    <li key={f.orderNumber}>#{f.orderNumber} {f.name} — {f.error}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {orders.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 px-1">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={selected.size === orders.length && orders.length > 0} onChange={toggleAll} className="size-5 accent-ink" />
            Select all
          </label>
          <span className="text-xs text-ink/50">{selected.size} selected</span>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {orders.map((order) => {
          const how = fulfilment(order.shabbos_label);
          const message = deliveryMessage(order.customer_name, from, to);
          const wa = whatsappLink(order.customer_phone, message);
          return (
            <article key={order.id} className={`rounded-2xl border bg-white p-4 ${selected.has(order.id) ? "border-honey ring-2 ring-honey/25" : "border-ink/10"}`}>
              <div className="flex items-start gap-3">
                <label className="-m-3 flex size-11 shrink-0 cursor-pointer items-center justify-center p-3">
                  <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} aria-label={`Select order ${order.order_number}`} className="size-5 accent-ink" />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">#{order.order_number} · {order.customer_name || "—"}</p>
                  <p className="mt-1 text-sm text-ink/75">
                    {order.customer_address || "No address on this order"}
                    {/* The town, set apart from the street. Two identical street
                        names in different cities are an hour of wasted driving. */}
                    {deliveryCity(order.shabbos_label) && (
                      <span className="ml-2 rounded-full bg-moss px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">
                        {deliveryCity(order.shabbos_label)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">{order.shabbos_label}</p>
                  {how === "unknown" && (
                    // Included deliberately: better a question on screen than an
                    // order quietly left out of the run.
                    <p className="mt-2 rounded-lg bg-honey/25 px-3 py-2 text-xs font-semibold">
                      Pickup or delivery was never recorded on this order — check before sending.
                    </p>
                  )}
                  {!order.customer_email && (
                    <p className="mt-2 text-xs font-semibold text-clay">No email address — send this one by WhatsApp.</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex h-11 flex-1 items-center justify-center rounded-full px-4 text-xs font-bold text-white ${timesValid ? "bg-[#25D366]" : "pointer-events-none bg-[#25D366]/40"}`}
                  >
                    {timesValid ? "WhatsApp" : "Enter times first"}
                  </a>
                ) : (
                  <span className="flex h-11 flex-1 items-center justify-center text-xs text-ink/40">No phone number</span>
                )}
                <button
                  type="button"
                  onClick={() => openPrintSheet(`/admin/orders/print?mode=driver&ids=${order.id}`)}
                  className="h-11 shrink-0 rounded-full border border-ink/20 px-4 text-xs font-bold"
                >
                  Driver sheet
                </button>
              </div>
            </article>
          );
        })}
        {orders.length === 0 && <p className="py-6 text-sm text-ink/55">Nothing waiting to go out.</p>}
      </div>
    </div>
  );
}
