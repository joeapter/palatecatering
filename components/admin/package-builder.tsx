"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Variant = { id: number; label: string; price: number };
type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  sold_by: string;
  active: boolean;
  variants: Variant[];
};
type Item = {
  id: number;
  productId: number;
  variantId: number | null;
  title: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
};
type OrderWindow = { id: number; name: string; cutoff_at: string };
type Bundle = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  serves: string;
  active: boolean;
  image_url: string;
  order_window_id: number | null;
  batch_limit: number | null;
  window_name: string | null;
  items: Item[];
};

async function post(body: unknown) {
  const response = await fetch("/api/admin/bundles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change could not be saved.");
  return data;
}

export function PackageBuilder() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [windows, setWindows] = useState<OrderWindow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [b, c] = await Promise.all([
        fetch("/api/admin/bundles").then((r) => r.json()),
        fetch("/api/admin/catalog").then((r) => r.json()),
      ]);
      if (b.error) throw new Error(b.error);
      setBundles(b.bundles || []);
      setWindows(b.windows || []);
      setProducts((c.products || []).filter((p: Product) => p.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load packages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function run(body: unknown) {
    try { await post(body); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
  }

  if (loading) return <p className="text-sm text-ink/55">Loading packages…</p>;

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      )}

      <form
        className="mb-10 flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!newName.trim()) return;
          await run({ action: "create", name: newName.trim() });
          setNewName("");
        }}
      >
        <label className="flex-1">
          <span className="text-xs font-bold tracking-wider text-ink/50 uppercase">
            New package for this week
          </span>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Week of 21 Aug — Family Shabbos"
            className="mt-2 w-full rounded-xl border border-ink/20 px-4 py-3 text-sm"
          />
        </label>
        <button className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
          Create package
        </button>
      </form>

      <div className="space-y-5">
        {bundles.map((bundle) => (
          <PackageRow
            key={bundle.id}
            bundle={bundle}
            windows={windows}
            products={products}
            open={openId === bundle.id}
            onToggle={() => setOpenId(openId === bundle.id ? null : bundle.id)}
            onRun={run}
          />
        ))}
        {bundles.length === 0 && (
          <p className="text-sm text-ink/55">No packages yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}

function PackageRow({
  bundle, windows, products, open, onToggle, onRun,
}: {
  bundle: Bundle;
  windows: OrderWindow[];
  products: Product[];
  open: boolean;
  onToggle: () => void;
  onRun: (body: unknown) => Promise<void>;
}) {
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selected = useMemo(
    () => products.find((p) => String(p.id) === productId),
    [products, productId],
  );

  const contentsTotal = bundle.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <section className="rounded-2xl border border-ink/10 bg-white">
      <header className="flex flex-wrap items-center gap-4 p-5">
        <button onClick={onToggle} className="flex-1 text-left">
          <p className="font-bold">
            {bundle.name}{" "}
            {!bundle.active && (
              <span className="ml-2 rounded-full bg-ink/10 px-2 py-1 text-[10px] font-bold uppercase">
                Hidden
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink/55">
            {bundle.items.length} dishes · ₪{Number(bundle.price).toFixed(0)}
            {bundle.window_name ? ` · ${bundle.window_name}` : " · every week"}
            {bundle.batch_limit ? ` · batch of ${bundle.batch_limit}` : ""}
          </p>
        </button>

        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={bundle.active}
            onChange={(event) => onRun({ action: "update", id: bundle.id, active: event.target.checked, orderWindowId: bundle.order_window_id, batchLimit: bundle.batch_limit })}
          />
          Live
        </label>
        <button onClick={onToggle} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold">
          {open ? "Close" : "Edit"}
        </button>
      </header>

      {open && (
        <div className="border-t border-ink/10 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Offered for
              <select
                defaultValue={bundle.order_window_id ?? ""}
                onChange={(event) => onRun({ action: "update", id: bundle.id, orderWindowId: event.target.value || null, batchLimit: bundle.batch_limit })}
                className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
              >
                <option value="">Every week</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Batch to make
              <input
                type="number"
                min={0}
                defaultValue={bundle.batch_limit ?? ""}
                placeholder="unlimited"
                onBlur={(event) => onRun({ action: "update", id: bundle.id, batchLimit: event.target.value, orderWindowId: bundle.order_window_id })}
                className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Serves
              <input
                defaultValue={bundle.serves || ""}
                placeholder="e.g. Serves 8–10"
                onBlur={(event) => onRun({ action: "update", id: bundle.id, serves: event.target.value, orderWindowId: bundle.order_window_id, batchLimit: bundle.batch_limit })}
                className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
              />
            </label>
          </div>

          <label className="mt-4 block text-xs font-bold tracking-wider text-ink/50 uppercase">
            Description
            <textarea
              defaultValue={bundle.description || ""}
              onBlur={(event) => onRun({ action: "update", id: bundle.id, description: event.target.value, orderWindowId: bundle.order_window_id, batchLimit: bundle.batch_limit })}
              className="mt-2 min-h-20 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>

          <h3 className="mt-8 text-xs font-bold tracking-wider text-ink/50 uppercase">Contents</h3>
          <ul className="mt-3 divide-y divide-ink/5">
            {bundle.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-3 text-sm">
                <span className="flex-1">
                  {item.title}
                  {item.variantLabel && <span className="text-ink/50"> · {item.variantLabel}</span>}
                </span>
                <input
                  type="number"
                  min={1}
                  defaultValue={item.quantity}
                  onBlur={(event) => {
                    const q = Number(event.target.value);
                    if (q > 0 && q !== item.quantity) onRun({ action: "setItemQuantity", itemId: item.id, quantity: q });
                  }}
                  className="w-20 rounded-lg border border-ink/20 px-2 py-1 text-center"
                />
                <span className="w-24 text-right tabular-nums text-ink/60">
                  ₪{(item.unitPrice * item.quantity).toFixed(0)}
                </span>
                <button
                  onClick={() => onRun({ action: "removeItem", itemId: item.id })}
                  className="text-xs underline"
                >
                  Remove
                </button>
              </li>
            ))}
            {bundle.items.length === 0 && (
              <li className="py-3 text-sm text-ink/50">Nothing in this package yet.</li>
            )}
          </ul>

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-[#f6f5f1] p-4">
            <label className="min-w-56 flex-1 text-xs font-bold tracking-wider text-ink/50 uppercase">
              Add dish
              <select
                value={productId}
                onChange={(event) => { setProductId(event.target.value); setVariantId(""); }}
                className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
              >
                <option value="">Choose…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.category} · {p.title}</option>
                ))}
              </select>
            </label>

            {selected && selected.variants.length > 0 && (
              <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
                Option
                <select
                  value={variantId}
                  onChange={(event) => setVariantId(event.target.value)}
                  className="mt-2 rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
                >
                  <option value="">Base · ₪{Number(selected.price).toFixed(0)}</option>
                  {selected.variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.label} · ₪{Number(v.price).toFixed(0)}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Qty
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                className="mt-2 w-20 rounded-xl border border-ink/20 px-3 py-2 text-center text-sm font-normal"
              />
            </label>

            <button
              disabled={!productId}
              onClick={async () => {
                await onRun({ action: "addItem", bundleId: bundle.id, productId: Number(productId), variantId: variantId ? Number(variantId) : null, quantity });
                setProductId(""); setVariantId(""); setQuantity(1);
              }}
              className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5">
            <p className="text-sm">
              <span className="text-ink/55">Package price (follows contents):</span>{" "}
              <b className="text-xl tabular-nums">₪{contentsTotal.toFixed(0)}</b>
            </p>
            <button
              onClick={() => {
                if (confirm(`Remove "${bundle.name}"? If it has been ordered it will be hidden instead of deleted.`)) {
                  onRun({ action: "delete", id: bundle.id });
                }
              }}
              className="text-xs font-semibold text-red-700 underline"
            >
              Delete package
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
