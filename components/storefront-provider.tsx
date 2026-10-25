"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ProductVariant, StorefrontProduct } from "@/lib/storefront/types";
import { useOverlay } from "@/lib/hooks/use-overlay";
import { trackAddToCart } from "@/lib/analytics";

export type OrderWindow = { id: number | string; name: string; event_date: string; cutoff_at: string };
export type DeliveryZone = { id: number | string; name: string; fee: number; minimum_order: number; free_delivery_threshold?: number | null };
export type OrderContextValue = { orderWindow: OrderWindow; fulfillment: "pickup" | "delivery"; deliveryZone?: DeliveryZone };
export type CartLine = { key: string; kind?: "product" | "bundle"; bundleId?: number; productId?: number | string; variantId?: number; title: string; image: string; variantLabel: string; unitLabel: string; unitPrice: number; quantity: number; quantityStep: number };
/** Minimal shape the cart needs from a bundle; avoids importing the server type. */
export type CartBundle = { id: number; name: string; slug: string; image: string; price: number; serves: string };

type StorefrontState = {
  cart: CartLine[]; orderContext: OrderContextValue | null; cartOpen: boolean;
  setCartOpen: (open: boolean) => void; openOrderChooser: () => void;
  /** Why the saved date was dropped, shown at the top of the chooser. Empty when nothing was dropped. */
  contextNotice: string;
  clearCart: () => void;
  addProduct: (product: StorefrontProduct, variant: ProductVariant, quantity: number) => void;
  addBundle: (bundle: CartBundle, quantity: number) => void;
  /** Used by reorder, which rebuilds the whole cart from a past order. */
  replaceCart: (lines: CartLine[]) => void;
  setQuantity: (key: string, quantity: number) => void; removeLine: (key: string) => void;
};

const StorefrontContext = createContext<StorefrontState | null>(null);
const STORAGE_KEY = "palate-storefront-v2";

export function useStorefront() { const value = useContext(StorefrontContext); if (!value) throw new Error("useStorefront must be used inside StorefrontProvider"); return value; }

export function StorefrontProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]); const [orderContext, setOrderContext] = useState<OrderContextValue | null>(null);
  const [cartOpen, setCartOpen] = useState(false); const [chooserOpen, setChooserOpen] = useState(false); const [hydrated, setHydrated] = useState(false);
  const [contextNotice, setContextNotice] = useState("");
  useEffect(() => { queueMicrotask(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); if (Array.isArray(saved.cart)) setCart(saved.cart); if (saved.orderContext) setOrderContext(saved.orderContext); } catch {} setHydrated(true); }); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, orderContext })); }, [cart, orderContext, hydrated]);

  /**
   * A saved order date does not stay valid, and nothing used to notice.
   *
   * The cart and the chosen date sit in localStorage for weeks. A customer who
   * shopped before Rosh Hashanah came back to a window that had since closed,
   * filled a basket against it, and was refused only at the payment step — with
   * an error and no way out, because the chooser then preselected that same
   * dead window and left "Start ordering" disabled. Checking here, once, means
   * they re-pick before they shop rather than after they have committed.
   *
   * The delivery area is checked with it: a zone that was switched off would
   * fail the same way, at the same late moment.
   */
  const validated = useRef(false);
  useEffect(() => {
    if (!hydrated || !orderContext || validated.current) return;
    validated.current = true;
    const saved = orderContext;
    (async () => {
      const response = await fetch(`/api/storefront/settings?window=${encodeURIComponent(String(saved.orderWindow.id))}`);
      if (!response.ok) return;
      const data = await response.json();
      // A database blip must not empty every customer's chosen date at once, so
      // an unverified answer is left alone rather than treated as "closed".
      if (data.degraded) return;

      // A "preview-…" date saved during an earlier outage has no row behind it
      // and never will. Left alone it sticks in localStorage for good and fails
      // at the payment step every time; the list is healthy now, so replace it.
      const realId = Number(saved.orderWindow.id);
      if (!Number.isInteger(realId) || realId <= 0) {
        setOrderContext(null);
        setContextNotice("Please choose your order date to continue — your basket is saved.");
        setChooserOpen(true);
        return;
      }
      if (!("requestedWindow" in data)) return;

      if (!data.requestedWindow) {
        setOrderContext(null);
        setContextNotice(`Ordering has closed for ${saved.orderWindow.name}. Pick a new date — your basket is saved.`);
        setChooserOpen(true);
        return;
      }
      // Refresh the stored copy: a name or cutoff edited in the admin should
      // reach a customer who is still holding the old one.
      const zones: DeliveryZone[] = data.deliveryZones || [];
      const zone = saved.deliveryZone ? zones.find((item) => String(item.id) === String(saved.deliveryZone!.id)) : undefined;
      if (saved.fulfillment === "delivery" && saved.deliveryZone && !zone) {
        setOrderContext({ ...saved, orderWindow: data.requestedWindow, deliveryZone: undefined });
        setContextNotice("We no longer deliver to the area you had chosen. Please choose another, or switch to pickup.");
        setChooserOpen(true);
        return;
      }
      setOrderContext({ ...saved, orderWindow: data.requestedWindow, ...(zone ? { deliveryZone: zone } : {}) });
    })().catch(() => {
      // Offline or blocked: leave the saved date alone. Checkout still checks
      // it on the server, so nothing unsafe gets through.
    });
  }, [hydrated, orderContext]);

  function addProduct(product: StorefrontProduct, variant: ProductVariant, quantity: number) {
    if (!orderContext) { setChooserOpen(true); return; }
    const key = `${product.id}:${variant.id ?? variant.label}`;
    setCart((lines) => { const existing = lines.find((line) => line.key === key); return existing ? lines.map((line) => line.key === key ? { ...line, quantity: line.quantity + quantity } : line) : [...lines, { key, productId: product.id, variantId: variant.id, title: product.title, image: product.image, variantLabel: variant.label, unitLabel: variant.unitLabel, unitPrice: variant.price, quantity, quantityStep: variant.quantityStep }]; });
    trackAddToCart({ id: product.id, title: product.title, price: variant.price, quantity, variant: variant.label });
    setCartOpen(true);
  }
  function addBundle(bundle: CartBundle, quantity: number) {
    if (!orderContext) { setChooserOpen(true); return; }
    // Namespaced so a bundle id can never collide with a product id.
    const key = `bundle:${bundle.id}`;
    setCart((lines) => { const existing = lines.find((line) => line.key === key); return existing ? lines.map((line) => line.key === key ? { ...line, quantity: line.quantity + quantity } : line) : [...lines, { key, kind: "bundle" as const, bundleId: bundle.id, title: bundle.name, image: bundle.image, variantLabel: bundle.serves || "Package", unitLabel: "Package", unitPrice: bundle.price, quantity, quantityStep: 1 }]; });
    trackAddToCart({ id: `bundle-${bundle.id}`, title: bundle.name, price: bundle.price, quantity, category: "Packages" });
    setCartOpen(true);
  }
  function setQuantity(key: string, quantity: number) { setCart((lines) => lines.map((line) => line.key === key ? { ...line, quantity: Math.max(line.quantityStep, quantity) } : line)); }
  function removeLine(key: string) { setCart((lines) => lines.filter((line) => line.key !== key)); }
  const value = { cart, orderContext, cartOpen, setCartOpen, openOrderChooser: () => setChooserOpen(true), contextNotice, clearCart: () => setCart([]), addProduct, addBundle, replaceCart: (lines: CartLine[]) => setCart(lines), setQuantity, removeLine };
  return <StorefrontContext.Provider value={value}>{children}<OrderChooser open={chooserOpen} current={orderContext} notice={contextNotice} onClose={() => setChooserOpen(false)} onSave={(selection) => { setOrderContext(selection); setContextNotice(""); setChooserOpen(false); }} /><CartDrawer /></StorefrontContext.Provider>;
}

/**
 * Rises from the bottom edge on a phone and centres on a desktop. A bottom
 * sheet is the right shape for a phone because it opens next to the thumb, and
 * `max-h-[90dvh]` with an internal scroll keeps the Start button reachable on a
 * short screen — the dialog previously had no scroll at all and could push its
 * own confirm button off the bottom.
 */
function OrderChooser({ open, current, notice, onClose, onSave }: { open: boolean; current: OrderContextValue | null; notice?: string; onClose: () => void; onSave: (value: OrderContextValue) => void }) {
  const [windows, setWindows] = useState<OrderWindow[]>([]); const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [windowId, setWindowId] = useState(""); const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup"); const [zoneId, setZoneId] = useState("");
  // Starts true and is only ever cleared once a fetch lands. Reopening the
  // sheet therefore keeps the list already on screen instead of blanking it,
  // and nothing sets state synchronously inside the effect below.
  const [loading, setLoading] = useState(true);
  // A date of their own — a bris, a sheva brachos, an ordinary Tuesday.
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customError, setCustomError] = useState("");
  const [customBusy, setCustomBusy] = useState(false);
  useOverlay(open, onClose);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const saved = current?.orderWindow.id;
    const query = saved ? `?window=${encodeURIComponent(String(saved))}` : "";
    fetch(`/api/storefront/settings${query}`).then((res) => res.json()).then((data) => {
      if (cancelled) return;
      const list: OrderWindow[] = data.orderWindows || [];
      // A custom date — a bris, a sheva brachos — is kept out of the public
      // list on purpose, so the customer holding one has to be shown it
      // explicitly or their own date would silently become someone else's.
      const held: OrderWindow | null = data.requestedWindow || null;
      const offered = held && !list.some((item) => String(item.id) === String(held.id)) ? [held, ...list] : list;
      setWindows(offered);
      setZones(data.deliveryZones || []);

      // Never preselect an id that is not among the options. A <select> whose
      // value matches nothing renders with no selection, leaves "Start
      // ordering" disabled, and on iOS fires no change event when the customer
      // picks the first item — so this week's date became genuinely unpickable
      // for anyone holding a closed window. Fall back to the first real option.
      const match = offered.find((item) => String(item.id) === String(saved));
      setWindowId(String(match?.id ?? offered[0]?.id ?? ""));

      const zoneList: DeliveryZone[] = data.deliveryZones || [];
      const zoneMatch = zoneList.find((item) => String(item.id) === String(current?.deliveryZone?.id));
      setZoneId(String(zoneMatch?.id ?? zoneList[0]?.id ?? ""));

      setFulfillment(current?.fulfillment || "pickup");
    }).catch(() => {
      // Leave whatever is on screen; the customer can close and retry.
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, current]);
  if (!open) return null;
  const selectedWindow = windows.find((item) => String(item.id) === windowId); const selectedZone = zones.find((item) => String(item.id) === zoneId);

  // Two days ahead, matching the cutoff rule. The server checks this again in
  // Israel time — this only stops the picker offering an impossible date.
  const earliest = new Date();
  earliest.setDate(earliest.getDate() + 2);
  const earliestDate = earliest.toISOString().slice(0, 10);

  async function useCustomDate() {
    setCustomBusy(true); setCustomError("");
    try {
      const response = await fetch("/api/storefront/custom-date", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: customDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That date could not be set up.");
      // Add it to the list and select it, so it behaves like any other window.
      setWindows((current) => [...current.filter((w) => String(w.id) !== String(data.window.id)), data.window]);
      setWindowId(String(data.window.id));
      setCustomOpen(false);
    } catch (caught) {
      setCustomError(caught instanceof Error ? caught.message : "That date could not be set up.");
    } finally {
      setCustomBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="order-context-title">
      <div className="absolute inset-0" onPointerDown={onClose} aria-hidden="true" />
      <div className="pb-safe relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[1.75rem] bg-cream shadow-2xl sm:max-h-[85dvh] sm:rounded-[2rem]">
        {/* Grab handle — the visual cue that a sheet can be dismissed. */}
        <div className="flex justify-center pt-3 sm:hidden"><span className="h-1.5 w-11 rounded-full bg-ink/20" /></div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-6 sm:px-10 sm:pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] text-clay uppercase">Before you shop</p>
              <h2 id="order-context-title" className="display t-h3 mt-2 font-semibold">Choose your order details</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="focus-ring -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl">×</button>
          </div>
          {notice && (
            <p className="mt-4 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm leading-6 font-semibold text-ink">
              {notice}
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-ink/65">We’ll keep this selection with your cart and show the menu available for that date.</p>
          <label className="mt-6 block text-xs font-bold uppercase">Order window
            <select value={windowId} onChange={(event) => setWindowId(event.target.value)} disabled={loading || !windows.length} className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3.5 text-base font-medium normal-case sm:text-sm disabled:opacity-60">
              {loading && !windows.length && <option value="">Loading dates…</option>}
              {windows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {/* The deadline, spelled out. Two windows can share a date — erev
              Sukkos is also erev Shabbos — and they close on different days, so
              the name alone does not tell the customer what they are choosing. */}
          {selectedWindow?.cutoff_at && (
            <p className="mt-2 text-xs leading-5 text-ink/55">
              Orders for this date close {new Date(selectedWindow.cutoff_at).toLocaleString("en-IL", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" })}.
            </p>
          )}

          {customOpen ? (
            <div className="mt-3 rounded-xl border border-ink/20 bg-white p-3">
              <label className="block text-xs font-bold uppercase">Your date
                <input
                  type="date"
                  value={customDate}
                  min={earliestDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-base normal-case sm:text-sm"
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-ink/55">
                Orders close at 23:59 two days before, so the earliest we can take is two days from today.
              </p>
              {customError && <p className="mt-2 text-xs font-semibold text-red-700">{customError}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={useCustomDate}
                  disabled={!customDate || customBusy}
                  className="focus-ring flex-1 rounded-full bg-ink px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
                >
                  {customBusy ? "Checking…" : "Use this date"}
                </button>
                <button onClick={() => { setCustomOpen(false); setCustomError(""); }} className="focus-ring rounded-full border border-ink/20 px-4 py-3 text-xs font-bold">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCustomOpen(true)}
              className="focus-ring mt-2 text-xs font-bold underline underline-offset-4"
            >
              Ordering for another date?
            </button>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {(["pickup", "delivery"] as const).map((type) => <button key={type} onClick={() => setFulfillment(type)} aria-pressed={fulfillment === type} className={`focus-ring rounded-xl border px-4 py-3.5 text-sm font-bold capitalize ${fulfillment === type ? "border-moss bg-moss text-white" : "border-ink/20 bg-white"}`}>{type}</button>)}
          </div>
          {fulfillment === "delivery" && <label className="mt-5 block text-xs font-bold uppercase">Delivery area
            <select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3.5 text-base font-medium normal-case sm:text-sm">{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · ₪{Number(zone.fee)}</option>)}</select>
          </label>}
        </div>
        <div className="border-t border-ink/10 px-6 py-4 sm:px-10">
          <button disabled={!selectedWindow || (fulfillment === "delivery" && !selectedZone)} onClick={() => selectedWindow && onSave({ orderWindow: selectedWindow, fulfillment, deliveryZone: fulfillment === "delivery" ? selectedZone : undefined })} className="focus-ring w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-40">Start ordering</button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer() {
  const { cart, cartOpen, setCartOpen, orderContext, setQuantity, removeLine } = useStorefront();
  const close = useCallback(() => setCartOpen(false), [setCartOpen]);
  useOverlay(cartOpen, close);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0); const zone = orderContext?.deliveryZone; const delivery = orderContext?.fulfillment === "delivery" && zone && (!zone.free_delivery_threshold || subtotal < Number(zone.free_delivery_threshold)) ? Number(zone.fee) : 0; const threshold = zone?.free_delivery_threshold ? Number(zone.free_delivery_threshold) : 0; const progress = threshold ? Math.min(100, subtotal / threshold * 100) : 100;
  if (!cartOpen) return null;
  return (
    // `dvh` rather than `h-full`: on iOS Safari the address bar shrinks the
    // viewport as you scroll, and a percentage height left the checkout button
    // hidden behind the browser chrome.
    <div className="fixed inset-0 z-[75] flex bg-ink/40" role="dialog" aria-modal="true" aria-label="Your cart">
      <div className="absolute inset-0" onPointerDown={close} aria-hidden="true" />
      <aside className="pb-safe relative ml-auto flex h-[100dvh] w-full max-w-md flex-col bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4 sm:p-6">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-clay uppercase">Your order</p>
            <h2 className="display text-3xl font-semibold">Cart</h2>
          </div>
          <button onClick={close} className="focus-ring -mr-2 flex size-11 items-center justify-center rounded-full text-2xl" aria-label="Close cart">×</button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
          {cart.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-ink/60">Your cart is empty.</p>
              <Link href="/shabbos" onClick={close} className="focus-ring mt-5 inline-block rounded-full border border-ink/20 px-5 py-3 text-sm font-bold">Browse the menu</Link>
            </div>
          ) : cart.map((line) => (
            <div key={line.key} className="flex gap-3 border-b border-ink/10 py-4">
              {line.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.image} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{line.title}</p>
                    <p className="text-xs text-ink/55">{line.variantLabel}</p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums">₪{(line.unitPrice * line.quantity).toFixed(2)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  {/* 44px targets: the old ±  were 24px tall and needed a
                      deliberate aim on a phone. */}
                  <div className="flex items-center rounded-full border border-ink/20 bg-white">
                    <button className="focus-ring flex size-11 items-center justify-center rounded-full text-lg" onClick={() => setQuantity(line.key, line.quantity - line.quantityStep)} aria-label={`Fewer ${line.title}`}>−</button>
                    <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                    <button className="focus-ring flex size-11 items-center justify-center rounded-full text-lg" onClick={() => setQuantity(line.key, line.quantity + line.quantityStep)} aria-label={`More ${line.title}`}>+</button>
                  </div>
                  <button onClick={() => removeLine(line.key)} className="focus-ring px-2 py-2 text-xs underline">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-ink/10 px-5 py-4 sm:p-6">
          {threshold > 0 && cart.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs">{subtotal >= threshold ? "You’ve unlocked free delivery." : `Add ₪${Math.max(0, threshold - subtotal).toFixed(0)} for free delivery.`}</p>
              <div className="h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-honey transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          <div className="flex justify-between text-sm"><span>Subtotal</span><b className="tabular-nums">₪{subtotal.toFixed(2)}</b></div>
          {orderContext?.fulfillment === "delivery" && <div className="mt-2 flex justify-between text-sm"><span>Delivery</span><b className="tabular-nums">{delivery ? `₪${delivery.toFixed(2)}` : "Free"}</b></div>}
          <div className="mt-3 flex justify-between border-t border-ink/10 pt-3 text-lg"><b>Total</b><b className="tabular-nums">₪{(subtotal + delivery).toFixed(2)}</b></div>
          <Link href="/checkout" onClick={close} className={`focus-ring mt-4 block rounded-full bg-ink px-6 py-4 text-center text-sm font-bold text-white ${cart.length ? "" : "pointer-events-none opacity-40"}`}>Checkout</Link>
        </div>
      </aside>
    </div>
  );
}
