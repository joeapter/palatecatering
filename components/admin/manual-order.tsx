"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrintLink, useInstalledApp } from "@/components/print-link";
import { MENUS } from "@/lib/storefront/menus";

type Variant = { id: number; label: string; price: number };
type Product = { id: number; title: string; category: string | null; soldBy: string | null; price: number; variants: Variant[]; menus?: string[] };

/** A menu's catalogue response, flattened to one list of dishes. */
function flatten(data: { categories?: { name: string; products?: Omit<Product, "category">[] }[] } | null): Product[] {
  const flat: Product[] = [];
  for (const category of data?.categories || []) {
    for (const product of category.products || []) {
      flat.push({
        id: product.id, title: product.title, category: category.name,
        soldBy: product.soldBy, price: product.price, variants: product.variants || [],
      });
    }
  }
  return flat;
}
type Row = { key: string; productId?: number; variantId?: number; title: string; unitLabel: string; unitPrice: number; quantity: number; note: string };
type OrderWindow = { id: number; name: string; eventType?: string | null };

/** An order already saved, loaded back into the form to be changed. */
export type ExistingOrder = {
  id: number;
  orderNumber: number;
  customer: { name: string; phone: string; email: string; address: string };
  orderWindowId: string;
  paymentMethod: string;
  notes: string;
  status: string;
  hasPaymentLink: boolean;
  items: Omit<Row, "key">[];
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bit", label: "Bit" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "zelle", label: "Zelle" },
  { value: "card_in_person", label: "Card in person" },
  { value: "unpaid", label: "Not paid yet" },
];

/**
 * Taking an order by hand — over the phone, at the door, or for a simcha.
 *
 * Dishes are picked from the menu rather than typed, so a manual order is
 * priced from the same catalogue as the storefront and cannot be sold at a
 * stale price by accident. A free line is there for the cases that genuinely
 * are not on the menu, like a quoted simcha or a delivery charge.
 *
 * The dishes on offer follow the menu the chosen date is cooked from, so a
 * Rosh Hashanah order is taken from the Rosh Hashanah menu rather than from
 * the Shabbos one that used to be the only list available here.
 *
 * Given an `existing` order the same form edits it in place instead, which is
 * what a quote needs: the customer changes their mind after it was written
 * down, and the order should change with them rather than be retyped.
 */

/** The menu a date is cooked from, when the window says which one it is. */
function menuForWindow(orderWindow: OrderWindow | undefined) {
  const tag = String(orderWindow?.eventType || "");
  return MENUS.some((menu) => menu.tag === tag) ? tag : "shabbos";
}

export function ManualOrder({ windows, existing }: { windows: OrderWindow[]; existing?: ExistingOrder }) {
  // The catalogue carries the menu it belongs to, so a list left over from the
  // previous menu is never shown as if it were this one.
  const [catalog, setCatalog] = useState<{ menu: string; products: Product[] }>({ menu: "", products: [] });
  // Every dish loaded so far, by id. A line added from the Rosh Hashanah menu
  // keeps its size picker after the selector moves back to Shabbos.
  const [known, setKnown] = useState<Record<number, Product>>({});
  const [rows, setRows] = useState<Row[]>(() =>
    (existing?.items || []).map((item, index) => ({ ...item, key: `existing-${index}` })),
  );
  const [customer, setCustomer] = useState(existing?.customer ?? { name: "", phone: "", email: "", address: "" });
  const [windowId, setWindowId] = useState(existing?.orderWindowId ?? String(windows[0]?.id ?? ""));
  const [menu, setMenu] = useState(() =>
    menuForWindow(windows.find((w) => String(w.id) === (existing?.orderWindowId ?? String(windows[0]?.id ?? "")))),
  );
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod ?? "cash");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pick, setPick] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: number; orderNumber: number; total: number; paymentLinkCancelled?: boolean; cookItemsUpdated?: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const installed = useInstalledApp();

  // The storefront endpoint only ever served Shabbos, which is why a Rosh
  // Hashanah order had nothing to pick from. The admin endpoint takes the menu
  // as an argument, so every seasonal menu can be ordered from by hand.
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/menu-catalog?menu=${encodeURIComponent(menu)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        const flat = flatten(data);
        setCatalog({ menu, products: flat });
        setKnown((current) => {
          const next = { ...current };
          for (const product of flat) next[product.id] = product;
          return next;
        });
      })
      .catch(() => { if (live) setCatalog({ menu, products: [] }); });
    return () => { live = false; };
  }, [menu]);

  // Search covers every menu, not just the one this date is cooked from. Orders
  // taken by hand are the office's call, so a Rosh Hashanah dish can be sold in
  // January or a Sukkos one after Sukkos. Loaded once; a dish on two menus is
  // listed once, naming both.
  const [everything, setEverything] = useState<Product[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(MENUS.map((option) =>
      fetch(`/api/admin/menu-catalog?menu=${encodeURIComponent(option.tag)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => flatten(data).map((product) => ({ ...product, menus: [option.label] })))
        .catch(() => [] as Product[]),
    )).then((lists) => {
      if (!live) return;
      const byId = new Map<number, Product>();
      for (const product of lists.flat()) {
        const seen = byId.get(product.id);
        if (seen) seen.menus = [...(seen.menus || []), ...(product.menus || [])];
        else byId.set(product.id, product);
      }
      const all = [...byId.values()];
      setEverything(all);
      setKnown((current) => {
        const next = { ...current };
        for (const product of all) next[product.id] = product;
        return next;
      });
    });
    return () => { live = false; };
  }, []);

  const loadingMenu = catalog.menu !== menu;
  const products = useMemo(() => (loadingMenu ? [] : catalog.products), [loadingMenu, catalog.products]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0), [rows]);

  // Typing "brisk" should find the brisket wherever it sits in the menu, which
  // a long dropdown of a hundred dishes cannot do on a phone.
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const words = query.split(/\s+/);
    return (everything ?? products)
      .filter((product) => {
        const haystack = `${product.title} ${product.category || ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .slice(0, 12);
  }, [everything, products, search]);

  const addProduct = useCallback((product: Product) => {
    const variant = product.variants[0];
    setRows((current) => [...current, {
      key: `${product.id}-${variant?.id ?? "base"}-${Date.now()}`,
      productId: product.id,
      variantId: variant?.id,
      title: product.title,
      unitLabel: variant?.label || product.soldBy || "Each",
      unitPrice: Number(variant?.price ?? product.price) || 0,
      quantity: 1,
      note: "",
    }]);
    setPick("");
    setSearch("");
  }, []);

  function addById(id: string) {
    const product = products.find((p) => String(p.id) === id);
    if (product) addProduct(product);
  }

  function addCustomLine() {
    setRows((current) => [...current, {
      key: `custom-${Date.now()}`, title: "", unitLabel: "", unitPrice: 0, quantity: 1, note: "",
    }]);
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/manual-order", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: existing ? "update" : "create",
          id: existing?.id,
          ...customer,
          customerName: customer.name, customerEmail: customer.email,
          customerPhone: customer.phone, customerAddress: customer.address,
          orderWindowId: windowId ? Number(windowId) : null,
          paymentMethod, notes,
          lines: rows.map((row) => ({
            productId: row.productId, variantId: row.variantId,
            title: row.title, unitLabel: row.unitLabel, unitPrice: row.unitPrice, quantity: row.quantity,
            note: row.note,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That order could not be saved.");
      setDone({
        id: data.id,
        orderNumber: data.orderNumber,
        total: data.total,
        paymentLinkCancelled: Boolean(data.paymentLinkCancelled),
        cookItemsUpdated: Number(data.cookItemsUpdated) || 0,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That order could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function createLink() {
    if (!done) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/manual-order", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "paymentLink", orderId: done.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That link could not be created.");
      setLinkUrl(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const invoiceHref = `/admin/orders/print?mode=invoice&ids=${done.id}`;
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-xs font-bold tracking-wider text-clay uppercase">{existing ? "Updated" : "Saved"}</p>
        <h2 className="display t-h3 mt-1 font-semibold">Order #{done.orderNumber}</h2>
        <p className="mt-2 text-sm text-ink/65">
          ₪{done.total.toFixed(2)} · {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}
          {paymentMethod === "unpaid" ? " — it will not reach the kitchen until it is paid or you change its status." : " — it is in the kitchen list now."}
        </p>

        {/* Two things a person has to be told after an edit, because both are
            about work that has already left this screen. */}
        {done.paymentLinkCancelled && (
          <p className="mt-3 rounded-xl bg-honey/25 p-3 text-xs font-semibold">
            The payment link you sent before has been cancelled — the total changed, so it would
            have charged the wrong amount. Create a new one below and send that instead.
          </p>
        )}
        {Boolean(done.cookItemsUpdated) && (
          <p className="mt-3 rounded-xl bg-cream p-3 text-xs font-semibold">
            {done.cookItemsUpdated} line{done.cookItemsUpdated === 1 ? "" : "s"} on the cook planner
            updated to match. Anything already ticked off as cooked was left alone.
          </p>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <PrintLink href={invoiceHref} className="focus-ring rounded-full bg-ink px-4 py-3.5 text-center text-sm font-bold text-white">
            {paymentMethod === "unpaid" ? "Print invoice" : "Print receipt"}
          </PrintLink>
          {paymentMethod === "unpaid" && (
            <button onClick={createLink} disabled={busy} className="focus-ring rounded-full border-2 border-ink px-4 py-3.5 text-sm font-bold disabled:opacity-50">
              {busy ? "Creating…" : "Create a payment link"}
            </button>
          )}
        </div>

        {linkUrl && (
          <div className="mt-4 rounded-xl bg-cream p-3">
            <p className="text-xs font-bold tracking-wider text-clay uppercase">Payment link</p>
            <p className="mt-1 text-xs break-all">{linkUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => navigator.clipboard?.writeText(linkUrl)} className="focus-ring rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold">Copy</button>
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "").replace(/^0/, "972")}?text=${encodeURIComponent(`Hi ${customer.name.split(" ")[0] || "there"}, here is the payment link for your Palate order #${done.orderNumber}: ${linkUrl}`)}`}
                  target={installed ? undefined : "_blank"} rel="noreferrer"
                  className="focus-ring rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white"
                >
                  Send on WhatsApp
                </a>
              )}
            </div>
            <p className="mt-2 text-[11px] text-ink/55">When they pay, the order is marked paid automatically.</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-4">
          {/* Editing again is the common next step for a quote, so it is offered
              straight away rather than through the orders list. */}
          <a href={`/admin/orders/${done.id}/edit`} className="focus-ring text-xs font-bold underline">
            {existing ? "Keep editing" : "Edit this order"}
          </a>
          {existing ? (
            <a href="/admin/orders" className="focus-ring text-xs font-bold underline">Back to orders</a>
          ) : (
            <button onClick={() => { setDone(null); setRows([]); setLinkUrl(""); setCustomer({ name: "", phone: "", email: "", address: "" }); }} className="focus-ring text-xs font-bold underline">
              Take another order
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
        <h2 className="text-xs font-bold tracking-wider text-clay uppercase">Customer</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name" className="h-11 rounded-xl border border-ink/20 px-3 text-sm" />
          <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} inputMode="tel" placeholder="Phone" className="h-11 rounded-xl border border-ink/20 px-3 text-sm" />
          <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} inputMode="email" placeholder="Email (for the invoice)" className="h-11 rounded-xl border border-ink/20 px-3 text-sm" />
          <input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Delivery address, or leave blank for pickup" className="h-11 rounded-xl border border-ink/20 px-3 text-sm" />
        </div>
        <label className="mt-3 block text-xs font-bold uppercase">For which week
          <select
            value={windowId}
            onChange={(e) => {
              setWindowId(e.target.value);
              // Choosing the date chooses the menu with it: that week the
              // kitchen is cooking one menu, and staff should not have to know
              // which tag it carries. They can still switch it by hand below.
              const chosen = windows.find((w) => String(w.id) === e.target.value);
              if (chosen) setMenu(menuForWindow(chosen));
            }}
            className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm font-medium normal-case"
          >
            <option value="">No particular date</option>
            {windows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold tracking-wider text-clay uppercase">Items</h2>
          <label className="text-xs font-bold tracking-wider text-clay uppercase">
            Menu
            <select
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
              className="ml-2 h-9 rounded-xl border border-ink/20 px-2 text-sm font-medium normal-case tracking-normal text-ink"
            >
              {MENUS.map((option) => <option key={option.tag} value={option.tag}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); addProduct(matches[0]); } }}
            placeholder="Search all menus…"
            className="h-11 w-full rounded-xl border border-ink/20 px-3 text-sm"
          />
          {search.trim() && (
            matches.length ? (
              <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-ink/10">
                {matches.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => addProduct(product)}
                      className="focus-ring flex w-full items-center justify-between gap-3 border-b border-ink/5 px-3 py-2.5 text-left last:border-0 hover:bg-cream"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{product.title}</span>
                        {(product.menus?.length || product.category) && (
                          <span className="block truncate text-xs text-ink/55">
                            {[product.menus?.join(", "), product.category].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">₪{(Number(product.variants[0]?.price ?? product.price) || 0).toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink/55">Nothing on any menu matches “{search.trim()}”.</p>
            )
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <select value={pick} onChange={(e) => addById(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-ink/20 px-3 text-sm font-medium normal-case">
            <option value="">
              {loadingMenu ? "Loading the menu…" : products.length ? "Add a dish from the menu…" : "No dishes on this menu yet"}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.title}{product.category ? ` · ${product.category}` : ""}</option>
            ))}
          </select>
          <button onClick={addCustomLine} className="focus-ring h-11 shrink-0 rounded-full border border-ink/20 px-4 text-xs font-bold">Custom line</button>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink/55">Nothing added yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((row) => {
              const product = row.productId ? known[row.productId] : undefined;
              return (
                <li key={row.key} className="rounded-xl border border-ink/10 p-3">
                  <div className="flex items-start gap-2">
                    {row.productId ? (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{row.title}</span>
                        {product && product.variants.length > 1 && (
                          <select
                            value={String(row.variantId ?? "")}
                            onChange={(e) => {
                              const variant = product.variants.find((v) => String(v.id) === e.target.value);
                              if (variant) update(row.key, { variantId: variant.id, unitLabel: variant.label, unitPrice: Number(variant.price) });
                            }}
                            className="mt-1 h-9 w-full rounded-lg border border-ink/20 px-2 text-xs"
                          >
                            {product.variants.map((v) => <option key={v.id} value={v.id}>{v.label} · ₪{v.price}</option>)}
                          </select>
                        )}
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1 space-y-2">
                        <input value={row.title} onChange={(e) => update(row.key, { title: e.target.value })} placeholder="Description" className="h-10 w-full rounded-lg border border-ink/20 px-2 text-sm" />
                        <input value={row.unitPrice || ""} onChange={(e) => update(row.key, { unitPrice: Number(e.target.value) || 0 })} inputMode="decimal" placeholder="Price each" className="h-10 w-full rounded-lg border border-ink/20 px-2 text-sm tabular-nums" />
                      </span>
                    )}
                    <button onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))} aria-label="Remove" className="focus-ring size-10 shrink-0 rounded-lg border border-ink/20">×</button>
                  </div>
                  {/* A note on the dish itself — "no onions", "cut in half" —
                      rather than on the order, so the kitchen reads it beside
                      the line it applies to on the cook list and the printout. */}
                  <input
                    value={row.note}
                    onChange={(e) => update(row.key, { note: e.target.value })}
                    placeholder="Note for this item (e.g. no onions, extra crispy)"
                    className="mt-2 h-10 w-full rounded-lg border border-ink/20 px-2 text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-full border border-ink/20">
                      <button onClick={() => update(row.key, { quantity: Math.max(1, row.quantity - 1) })} className="focus-ring size-9 rounded-full">−</button>
                      <span className="min-w-8 text-center text-sm font-bold tabular-nums">{row.quantity}</span>
                      <button onClick={() => update(row.key, { quantity: row.quantity + 1 })} className="focus-ring size-9 rounded-full">+</button>
                    </div>
                    <span className="text-sm font-bold tabular-nums">₪{(row.unitPrice * row.quantity).toFixed(2)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 flex justify-between border-t border-ink/10 pt-3 text-lg font-bold">
          <span>Total</span><span className="tabular-nums">₪{total.toFixed(2)}</span>
        </p>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
        <h2 className="text-xs font-bold tracking-wider text-clay uppercase">Payment</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.value}
              onClick={() => setPaymentMethod(method.value)}
              aria-pressed={paymentMethod === method.value}
              className={`rounded-xl border px-3 py-3 text-sm font-bold ${paymentMethod === method.value ? "border-moss bg-moss text-white" : "border-ink/20"}`}
            >
              {method.label}
            </button>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Allergies or notes for the kitchen" className="mt-3 w-full rounded-xl border border-ink/20 p-3 text-sm" />
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <button
        onClick={save}
        disabled={busy || rows.length === 0 || !customer.name.trim()}
        className="focus-ring w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : existing ? `Save changes · ₪${total.toFixed(2)}` : `Save order · ₪${total.toFixed(2)}`}
      </button>
      {existing?.hasPaymentLink && paymentMethod === "unpaid" && (
        <p className="text-center text-xs text-ink/55">
          A payment link is out with this customer. Changing the total cancels it, and you send a new one.
        </p>
      )}
      {rows.length > 0 && !customer.name.trim() && <p className="text-center text-xs text-ink/55">Add the customer&rsquo;s name to save.</p>}
    </div>
  );
}
