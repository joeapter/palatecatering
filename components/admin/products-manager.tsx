"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Variant = {
  id: number;
  label: string;
  soldBy: string;
  price: string | number;
  active: boolean;
};
type Product = {
  id: number;
  category: string;
  title: string;
  description: string;
  price: string;
  sold_by: string;
  active: boolean;
  needs_price_review: boolean;
  menu_tags: string[] | null;
  variants: Variant[];
};
type Category = { id: number; name: string; menu: string; sort_order: number; active: boolean };

async function send(body: unknown) {
  const response = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change could not be saved.");
  return data;
}

export function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<string[]>([]);
  const [menu, setMenu] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [adding, setAdding] = useState(false);
  // Pending price edits, keyed "p:<id>" for products and "v:<id>" for variants.
  const [pending, setPending] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async (currentMenu: string, currentQuery: string) => {
    try {
      const params = new URLSearchParams();
      if (currentMenu) params.set("menu", currentMenu);
      if (currentQuery) params.set("q", currentQuery);
      const data = await fetch(`/api/admin/products?${params}`).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setMenus(data.menus || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(menu, query); });
  }, [load, menu, query]);

  async function run(body: unknown) {
    setError("");
    try { await send(body); await load(menu, query); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
  }

  function stage(key: string, price: number) {
    setPending((current) => ({ ...current, [key]: price }));
  }

  /** Saves either the whole pending set, or just the keys for one row. */
  async function savePending(keys?: string[]) {
    const chosen = keys ? keys.filter((key) => key in pending) : Object.keys(pending);
    if (!chosen.length) return;
    const products = chosen.filter((k) => k.startsWith("p:")).map((k) => ({ id: Number(k.slice(2)), price: pending[k] }));
    const variants = chosen.filter((k) => k.startsWith("v:")).map((k) => ({ id: Number(k.slice(2)), price: pending[k] }));
    setSaving(true); setError(""); setStatus("");
    try {
      const result = await send({ action: "bulkSave", products, variants });
      setPending((current) => {
        const next = { ...current };
        for (const key of chosen) delete next[key];
        return next;
      });
      await load(menu, query);
      setStatus(`Saved ${result.saved} price${result.saved === 1 ? "" : "s"}`);
      setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = Object.keys(pending).length;

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products) {
      if (!map.has(product.category)) map.set(product.category, []);
      map.get(product.category)!.push(product);
    }
    return [...map.entries()];
  }, [products]);

  if (loading) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div>
      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setTab("products"); setAdding((value) => !value); }}
          className="focus-ring rounded-full bg-ink px-5 py-3 text-xs font-bold text-white"
        >
          {adding ? "Cancel" : "Add a dish"}
        </button>
      </div>

      {adding && (
        <AddProduct
          categories={categories}
          menus={menus}
          onCreate={async (payload) => {
            await run({ action: "createProduct", ...payload });
            setAdding(false);
            setStatus(`${payload.title} added. Set its sizes below if it comes in more than one.`);
          }}
        />
      )}

      <div className="mb-6 flex rounded-full bg-ink/5 p-1">
        {(["products", "categories"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-full px-5 py-2 text-sm font-bold capitalize ${tab === value ? "bg-ink text-white" : "text-ink/60"}`}
          >
            {value}
          </button>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="sticky top-2 z-30 mb-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-honey bg-white px-5 py-3 shadow-lg">
          <p className="flex-1 text-sm font-semibold">
            {pendingCount} unsaved price change{pendingCount === 1 ? "" : "s"}
          </p>
          <button onClick={() => setPending({})} className="text-sm underline">Discard</button>
          <button
            disabled={saving}
            onClick={() => savePending()}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save all changes"}
          </button>
        </div>
      )}
      {status && (
        <p className="mb-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{status}</p>
      )}

      {tab === "categories" ? (
        <CategoriesTable categories={categories} onRun={run} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              value={menu}
              onChange={(event) => setMenu(event.target.value)}
              className="rounded-xl border border-ink/20 bg-white px-4 py-2 text-sm"
            >
              <option value="">All menus</option>
              {menus.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search items…"
              className="min-w-56 flex-1 rounded-xl border border-ink/20 bg-white px-4 py-2 text-sm"
            />
            <p className="text-sm text-ink/55">{products.length} items</p>
          </div>

          <div className="space-y-8">
            {grouped.map(([category, items]) => (
              <section key={category}>
                <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">{category}</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                  {items.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      open={openId === product.id}
                      onToggle={() => setOpenId(openId === product.id ? null : product.id)}
                      onRun={run}
                      pending={pending}
                      onStage={stage}
                      onSaveRow={savePending}
                      saving={saving}
                    />
                  ))}
                </div>
              </section>
            ))}
            {grouped.length === 0 && <p className="text-sm text-ink/55">No items match.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function ProductRow({
  product, open, onToggle, onRun, pending, onStage, onSaveRow, saving,
}: {
  product: Product;
  open: boolean;
  onToggle: () => void;
  onRun: (body: unknown) => Promise<void>;
  pending: Record<string, number>;
  onStage: (key: string, price: number) => void;
  onSaveRow: (keys: string[]) => Promise<void>;
  saving: boolean;
}) {
  const rowKeys = [`p:${product.id}`, ...product.variants.map((v) => `v:${v.id}`)];
  const rowDirty = rowKeys.some((key) => key in pending);
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState("");

  return (
    <div className="border-b border-ink/5 last:border-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button onClick={onToggle} className="min-w-48 flex-1 text-left">
          <p className="font-semibold">
            {product.title}
            {product.needs_price_review && (
              <span className="ml-2 rounded-full bg-honey px-2 py-0.5 text-[10px] font-bold uppercase">
                Review price
              </span>
            )}
            {!product.active && (
              <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase">
                Hidden
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink/50">
            {product.sold_by || "—"} ·{" "}
            {product.variants.length
              ? `${product.variants.length} size${product.variants.length === 1 ? "" : "s"}`
              : "no sizes"}{" "}
            · {(product.menu_tags || ["shabbos"]).join(", ")}
          </p>
        </button>

        <label className="text-xs font-bold tracking-wider text-ink/45 uppercase">
          Base ₪
          <input
            type="number"
            min={0}
            defaultValue={Number(product.price).toFixed(0)}
            onChange={(event) => {
              const price = Number(event.target.value);
              if (Number.isFinite(price) && price >= 0) onStage(`p:${product.id}`, price);
            }}
            className={`ml-2 w-24 rounded-lg border px-2 py-1.5 text-sm font-normal tabular-nums ${`p:${product.id}` in pending ? "border-honey bg-honey/10" : "border-ink/20"}`}
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={product.active}
            onChange={(event) => onRun({ action: "updateProduct", id: product.id, active: event.target.checked })}
          />
          Live
        </label>

        {rowDirty && (
          <button
            disabled={saving}
            onClick={() => onSaveRow(rowKeys)}
            className="h-11 rounded-full bg-honey px-4 text-xs font-bold text-ink disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        <button onClick={onToggle} className="h-11 rounded-full border border-ink/20 px-4 text-xs font-bold">
          {open ? "Close" : "Sizes & details"}
        </button>
      </div>

      {open && (
        <div className="border-t border-ink/10 bg-[#faf9f6] px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Name
              <input
                defaultValue={product.title}
                onBlur={(event) => event.target.value !== product.title && onRun({ action: "updateProduct", id: product.id, title: event.target.value })}
                className="mt-2 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
              />
            </label>
            <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
              Sold by
              <input
                defaultValue={product.sold_by || ""}
                onBlur={(event) => event.target.value !== product.sold_by && onRun({ action: "updateProduct", id: product.id, soldBy: event.target.value })}
                className="mt-2 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
              />
            </label>
          </div>

          <label className="mt-4 block text-xs font-bold tracking-wider text-ink/50 uppercase">
            Description
            <textarea
              defaultValue={product.description || ""}
              onBlur={(event) => event.target.value !== product.description && onRun({ action: "updateProduct", id: product.id, description: event.target.value })}
              className="mt-2 min-h-20 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>

          <h4 className="mt-7 text-xs font-bold tracking-wider text-ink/50 uppercase">
            Sizes &amp; prices
          </h4>
          <ul className="mt-3 space-y-2">
            {product.variants.map((variant) => (
              <li key={variant.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2">
                <input
                  defaultValue={variant.label}
                  onBlur={(event) => event.target.value !== variant.label && onRun({ action: "updateVariant", id: variant.id, label: event.target.value, soldBy: event.target.value })}
                  className="h-11 min-w-32 flex-1 rounded-lg border border-ink/20 px-3 text-sm"
                  aria-label="Size label"
                />
                <label className="text-xs font-bold text-ink/45">
                  ₪
                  <input
                    type="number"
                    min={0}
                    defaultValue={Number(variant.price).toFixed(0)}
                    onChange={(event) => {
                      const price = Number(event.target.value);
                      if (Number.isFinite(price) && price >= 0) onStage(`v:${variant.id}`, price);
                    }}
                    className={`ml-1 w-24 rounded-lg border px-2 py-1.5 text-sm font-normal tabular-nums ${`v:${variant.id}` in pending ? "border-honey bg-honey/10" : "border-ink/20"}`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={variant.active}
                    onChange={(event) => onRun({ action: "updateVariant", id: variant.id, active: event.target.checked })}
                  />
                  Live
                </label>
                <button
                  onClick={() => {
                    if (confirm(`Remove the "${variant.label}" size? It will be hidden, not deleted.`)) {
                      onRun({ action: "deleteVariant", id: variant.id });
                    }
                  }}
                  className="text-xs font-semibold text-red-700 underline"
                >
                  Remove
                </button>
              </li>
            ))}
            {product.variants.length === 0 && (
              <li className="text-sm text-ink/50">
                No sizes yet — add one so this item can be added to a cart.
              </li>
            )}
          </ul>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="New size (e.g. Full Pan)"
              className="min-w-40 flex-1 rounded-lg border border-ink/20 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              value={newPrice}
              onChange={(event) => setNewPrice(event.target.value)}
              placeholder="₪"
              className="w-28 rounded-lg border border-ink/20 px-3 py-2 text-sm tabular-nums"
            />
            <button
              disabled={!newLabel || !newPrice}
              onClick={async () => {
                await onRun({ action: "addVariant", productId: product.id, label: newLabel, price: Number(newPrice) });
                setNewLabel(""); setNewPrice("");
              }}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Add size
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesTable({
  categories, onRun,
}: {
  categories: Category[];
  onRun: (body: unknown) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-ink/10 text-left text-xs tracking-wider text-ink/50 uppercase">
          <tr>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3">Menu</th>
            <th className="px-5 py-3 w-28">Order</th>
            <th className="px-5 py-3 w-20">Live</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-b border-ink/5 last:border-0">
              <td className="px-5 py-2">
                <input
                  defaultValue={category.name}
                  onBlur={(event) => event.target.value !== category.name && onRun({ action: "updateCategory", id: category.id, name: event.target.value })}
                  className="h-11 w-full rounded-lg border border-ink/20 px-3"
                />
              </td>
              <td className="px-5 py-2 text-ink/60">{category.menu}</td>
              <td className="px-5 py-2">
                <input
                  type="number"
                  defaultValue={category.sort_order}
                  onBlur={(event) => Number(event.target.value) !== category.sort_order && onRun({ action: "updateCategory", id: category.id, sortOrder: Number(event.target.value) })}
                  className="h-11 w-24 rounded-lg border border-ink/20 px-3 tabular-nums"
                />
              </td>
              <td className="px-5 py-2">
                <input
                  type="checkbox"
                  checked={category.active}
                  onChange={(event) => onRun({ action: "updateCategory", id: category.id, active: event.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/**
 * Adding a dish.
 *
 * The API could already create products; nothing in the interface ever called
 * it, so the only way to put a dish on the menu was to open a database client.
 *
 * Kept to the four things a dish cannot exist without — name, category, price
 * and how it is sold. Description, photo and extra sizes are all editable
 * afterwards, and demanding them up front would mean holding a dish back from
 * the menu because nobody had written a sentence about it yet.
 */
function AddProduct({
  categories, menus, onCreate,
}: {
  categories: Category[];
  menus: string[];
  onCreate: (payload: { title: string; category: string; price: number; soldBy: string; description: string; menuTags: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [soldBy, setSoldBy] = useState("Each");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>(["shabbos"]);
  const [busy, setBusy] = useState(false);

  // Existing category names, so a new dish joins a category that already shows
  // on the site rather than creating a near-duplicate with different casing.
  const names = [...new Set(categories.map((c) => c.name))].sort();
  const valid = title.trim() && category.trim() && Number(price) > 0;

  return (
    <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
      <p className="text-xs font-bold tracking-wider text-clay uppercase">New dish</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase">Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sweet and Saucy Brisket" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case" />
        </label>
        <label className="block text-xs font-bold uppercase">Category
          <input
            list="admin-category-names"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Meat"
            className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case"
          />
          <datalist id="admin-category-names">
            {names.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
        <label className="block text-xs font-bold uppercase">Price
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="180" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm tabular-nums" />
        </label>
        <label className="block text-xs font-bold uppercase">Sold by
          <input value={soldBy} onChange={(e) => setSoldBy(e.target.value)} placeholder="1.5 Kg / Half Pan / Each" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case" />
        </label>
      </div>

      <label className="mt-3 block text-xs font-bold uppercase">Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional — you can write this later." className="mt-1 w-full rounded-xl border border-ink/20 p-3 text-sm normal-case" />
      </label>

      <p className="mt-4 text-xs font-bold uppercase">Which menus</p>
      <p className="mt-1 text-xs text-ink/55">A dish can be on more than one. Leave Shabbos ticked for a normal weekly item.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(menus.length ? menus : ["shabbos"]).map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setTags((current) => (on ? current.filter((t) => t !== tag) : [...current, tag]))}
              aria-pressed={on}
              className={`rounded-full px-4 py-2.5 text-xs font-bold capitalize ${on ? "bg-moss text-white" : "border border-ink/20"}`}
            >
              {tag.replace(/-/g, " ")}
            </button>
          );
        })}
      </div>

      <button
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate({
              title: title.trim(),
              category: category.trim(),
              price: Number(price),
              soldBy: soldBy.trim() || "Each",
              description: description.trim(),
              menuTags: tags.length ? tags : ["shabbos"],
            });
            setTitle(""); setPrice(""); setDescription("");
          } finally {
            setBusy(false);
          }
        }}
        className="focus-ring mt-5 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add to the menu"}
      </button>
      {!valid && <p className="mt-2 text-center text-xs text-ink/55">A name, a category and a price are needed.</p>}
    </div>
  );
}
