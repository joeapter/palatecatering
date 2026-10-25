"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMessage, whatsappLink, type MessageKind } from "@/lib/notifications/messages";
import { useMessageTemplates } from "@/lib/hooks/use-message-templates";
import { PrintLink } from "@/components/print-link";

type Item = { title?: string; quantity?: number; soldBy?: string; note?: string };
type Order = {
  id: number; order_number: number; customer_name: string | null; customer_phone: string | null;
  customer_address: string | null; shabbos_label: string | null; allergies: string | null;
  items: Item[]; status: string; created_at: string;
};

/** The stages an order passes through, for the filter chips and the status pill. */
const FLOW: { status: string; label: string }[] = [
  { status: "new", label: "New" },
  { status: "in_progress", label: "Making" },
  { status: "ready", label: "Ready" },
  { status: "out_for_delivery", label: "Out" },
];

/**
 * Is this order going out on a van, or being collected?
 *
 * The new checkout writes it into the label, which is the reliable signal.
 * Older orders only have an address field, and some of those literally read
 * "Beit Shemesh pickup" or "Delivery quote requested" — so an address alone
 * cannot be trusted to mean delivery.
 */
function isDelivery(order: Order) {
  const label = order.shabbos_label || "";
  if (/delivery to/i.test(label)) return true;
  if (/pickup/i.test(label)) return false;
  const address = (order.customer_address || "").trim();
  if (!address) return false;
  return !/pickup|quote requested/i.test(address);
}

/**
 * The next step for this particular order.
 *
 * A pickup order has no "out for delivery" stage. Previously every order was
 * forced through it before it could be closed, so collecting an order meant
 * marking it out for delivery first — staff either recorded something untrue
 * or left it open forever, which is why finished orders stayed on the list.
 */
function nextStep(order: Order): { next: string; label: string } | null {
  const delivery = isDelivery(order);
  switch (order.status) {
    case "new": return { next: "in_progress", label: "Start making" };
    case "in_progress": return { next: "ready", label: delivery ? "Ready to go out" : "Ready for pickup" };
    case "ready": return delivery
      ? { next: "out_for_delivery", label: "Out for delivery" }
      : { next: "delivered", label: "Collected" };
    case "out_for_delivery": return { next: "delivered", label: "Delivered" };
    default: return null;
  }
}

const WHATSAPP_FOR: Record<string, MessageKind | undefined> = {
  new: "confirmed",
  in_progress: "confirmed",
  ready: "ready",
  out_for_delivery: "out_for_delivery",
};

/**
 * The kitchen screen.
 *
 * Built for a phone held in one hand in a working kitchen: one order per card,
 * a single obvious next action on each, and targets big enough to hit without
 * looking closely. Everything an order needs — print, message, advance — is on
 * the card, so nothing requires navigating away and finding your place again.
 */
export function KitchenBoard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [scope, setScope] = useState<"active" | "all">("active");
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const { bodyFor, labelFor } = useMessageTemplates();

  const load = useCallback(async (which: "active" | "all") => {
    try {
      const response = await fetch(`/api/kitchen-auth/orders?scope=${which}`);
      if (!response.ok) throw new Error("Could not load orders.");
      const data = await response.json();
      setOrders(data.orders || []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load orders.");
      setOrders([]);
    }
  }, []);

  useEffect(() => { load(scope); }, [scope, load]);

  // A kitchen screen left open on a counter should not show stale orders when
  // someone glances at it twenty minutes later.
  useEffect(() => {
    const timer = window.setInterval(() => load(scope), 60_000);
    return () => window.clearInterval(timer);
  }, [scope, load]);

  async function setStatus(order: Order, next: string) {
    setBusy(order.id);
    try {
      const response = await fetch("/api/kitchen-auth/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: order.id, status: next }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not update.");
      await load(scope);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (orders === null) return <p className="p-5 text-sm text-ink/55">Loading orders…</p>;

  const counts = FLOW.reduce<Record<string, number>>((acc, step) => {
    acc[step.status] = orders.filter((o) => o.status === step.status).length;
    return acc;
  }, {});
  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const selectedIds = [...selected].join(",");

  return (
    <div className="pb-28">
      <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip label={`All (${orders.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
        {FLOW.map((step) => (
          <Chip key={step.status} label={`${step.label} (${counts[step.status] ?? 0})`} active={filter === step.status} onClick={() => setFilter(step.status)} />
        ))}
        <Chip label={scope === "active" ? "Show recent" : "Show active"} active={false} onClick={() => setScope(scope === "active" ? "all" : "active")} />
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink/55">Nothing here right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((order) => {
            const step = FLOW.find((s) => s.status === order.status);
            const advance = nextStep(order);
            const finishLabel = isDelivery(order) ? "Delivered" : "Collected";
            const kind = WHATSAPP_FOR[order.status];
            const wa = kind
              ? whatsappLink(order.customer_phone, buildMessage(kind, {
                  orderNumber: order.order_number,
                  customerName: order.customer_name,
                  customerPhone: order.customer_phone,
                  windowLabel: order.shabbos_label,
                  items: order.items,
                }, bodyFor(kind)))
              : null;

            return (
              <li key={order.id} className={`rounded-2xl border-2 bg-white p-4 ${selected.has(order.id) ? "border-moss" : "border-ink/10"}`}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggle(order.id)}
                      className="mt-1 size-6 shrink-0"
                      aria-label={`Select order ${order.order_number} for printing`}
                    />
                    <span className="min-w-0">
                      <span className="block text-lg font-bold">#{order.order_number} · {order.customer_name || "Guest"}</span>
                      <span className="mt-0.5 block text-xs text-ink/55">{order.shabbos_label || "—"}</span>
                      <span className="mt-0.5 block text-xs text-ink/55">
                        {order.customer_address ? `🚚 ${order.customer_address}` : "🏠 Pickup"}
                      </span>
                    </span>
                  </label>
                  {/* No prices on this screen. The kitchen needs to know what to
                      make and where it is going; what the customer paid is not
                      its business, and the printed kitchen and driver sheets
                      already omit it for the same reason. */}
                  <span className="shrink-0 text-right">
                    <span className="inline-block rounded-full bg-cream px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                      {step?.label ?? order.status}
                    </span>
                  </span>
                </div>

                {order.allergies && (
                  <p className="mt-3 rounded-xl border-2 border-clay bg-clay/5 p-3 text-sm font-bold text-clay">
                    ⚠ {order.allergies}
                  </p>
                )}

                <ul className="mt-3 space-y-1 text-sm">
                  {(order.items || []).slice(0, 8).map((item, index) => (
                    <li key={index} className="flex justify-between gap-3 border-b border-ink/5 pb-1">
                      <span className="min-w-0">
                        <span className="block truncate">{item.title || "Item"}{item.soldBy ? ` · ${item.soldBy}` : ""}</span>
                        {item.note && <span className="block text-xs font-bold text-clay">→ {item.note}</span>}
                      </span>
                      <b className="shrink-0 tabular-nums">×{item.quantity ?? 1}</b>
                    </li>
                  ))}
                  {(order.items || []).length > 8 && (
                    <li className="text-xs text-ink/50">and {(order.items || []).length - 8} more — see the printed sheet</li>
                  )}
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  {advance && (
                    <button
                      onClick={() => setStatus(order, advance.next)}
                      disabled={busy === order.id}
                      className="focus-ring flex-1 rounded-full bg-ink px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busy === order.id ? "Saving…" : advance.label}
                    </button>
                  )}

                  {/* Closing the order is always one tap, from any stage. Staff
                      skip steps when a shift is busy, and an order that cannot
                      be finished without walking back through them stays on the
                      list forever. */}
                  {advance?.next !== "delivered" && (
                    <button
                      onClick={() => setStatus(order, "delivered")}
                      disabled={busy === order.id}
                      className="focus-ring rounded-full border-2 border-moss px-4 py-3.5 text-sm font-bold text-moss disabled:opacity-50"
                    >
                      {finishLabel}
                    </button>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring rounded-full bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white"
                    >
                      {labelFor(kind!)}
                    </a>
                  )}
                  <PrintLink
                    href={`/admin/orders/print?mode=kitchen&ids=${order.id}`}
                    className="focus-ring rounded-full border border-ink/20 px-4 py-3.5 text-sm font-bold"
                  >
                    Kitchen
                  </PrintLink>
                  <PrintLink
                    href={`/admin/orders/print?mode=driver&ids=${order.id}`}
                    className="focus-ring rounded-full border border-ink/20 px-4 py-3.5 text-sm font-bold"
                  >
                    Delivery
                  </PrintLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Batch printing is the one thing done to many orders at once — Friday
          morning, print the lot — so it gets a standing bar rather than living
          at the bottom of a long list. */}
      {selected.size > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-ink/10 bg-cream/95 p-3 backdrop-blur">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:flex sm:items-center">
            <button onClick={() => setSelected(new Set())} className="focus-ring col-span-2 rounded-full border border-ink/20 px-4 py-3 text-xs font-bold sm:col-span-1">
              Clear ({selected.size})
            </button>
            {/* The cook list leads: starting a shift, "how much of each thing"
                is the question, not "what is in each box". */}
            <PrintLink
              href={`/admin/orders/print?mode=cooklist&ids=${selectedIds}`}
              className="focus-ring flex-1 rounded-full bg-ink px-4 py-3.5 text-center text-sm font-bold text-white"
            >
              Cook list ×{selected.size}
            </PrintLink>
            <PrintLink
              href={`/admin/orders/print?mode=kitchen&ids=${selectedIds}`}
              className="focus-ring flex-1 rounded-full border-2 border-ink px-4 py-3.5 text-center text-sm font-bold"
            >
              Sheets ×{selected.size}
            </PrintLink>
            <PrintLink
              href={`/admin/orders/print?mode=driver&ids=${selectedIds}`}
              className="focus-ring flex-1 rounded-full border border-ink/25 px-4 py-3.5 text-center text-sm font-bold"
            >
              Delivery ×{selected.size}
            </PrintLink>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring shrink-0 rounded-full px-4 py-2.5 text-xs font-bold whitespace-nowrap ${active ? "bg-ink text-white" : "border border-ink/20 bg-white"}`}
    >
      {label}
    </button>
  );
}
