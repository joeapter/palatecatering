"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Ingredient = { id?: number; name: string; quantity: number | string | null; unit: string | null; note: string | null };
type Recipe = {
  id: number; product_id: number; title: string; category: string | null; sold_by: string | null;
  base_quantity: string | number; base_unit: string | null; method: string | null; notes: string | null;
  updated_at: string; ingredients: Ingredient[];
};
type AvailableProduct = { id: number; title: string; sold_by: string | null; category: string | null };

/**
 * The recipe book, used unchanged by the admin and the kitchen.
 *
 * The point of it is the scaling: a recipe is written once for a known yield,
 * and the kitchen sets how many they are making so the amounts multiply. That
 * removes the arithmetic staff currently do in their heads, or ask about.
 *
 * Deliberately tolerant of half-finished entries — a dish with a name and three
 * ingredients is useful long before anyone writes the method — because the
 * intent is to fill this in over time rather than in one sitting.
 */
export function RecipeBook({ canDelete }: { canDelete: boolean }) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [available, setAvailable] = useState<AvailableProduct[]>([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/recipes");
      if (!response.ok) throw new Error("Could not load recipes.");
      const data = await response.json();
      setRecipes(data.recipes || []);
      setAvailable(data.availableProducts || []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load recipes.");
      setRecipes([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return recipes || [];
    return (recipes || []).filter((r) =>
      r.title.toLowerCase().includes(term) ||
      (r.category || "").toLowerCase().includes(term) ||
      r.ingredients.some((i) => i.name.toLowerCase().includes(term)),
    );
  }, [recipes, query]);

  async function send(body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/recipes", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That change could not be saved.");
      await load();
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (recipes === null) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a dish or an ingredient"
          className="h-11 min-w-0 flex-1 rounded-full border border-ink/20 bg-white px-4 text-sm"
        />
        <button
          onClick={() => setAdding((value) => !value)}
          className="h-11 shrink-0 rounded-full bg-ink px-5 text-xs font-bold text-white"
        >
          {adding ? "Cancel" : "Add a recipe"}
        </button>
      </div>

      {adding && <AddRecipe products={available} busy={busy} onCreate={async (productId, baseQuantity, baseUnit) => {
        const created = await send({ action: "create", productId, baseQuantity, baseUnit });
        if (created?.id) { setAdding(false); setOpenId(created.id); setEditing(created.id); }
      }} />}

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm leading-6 text-ink/60">
          {recipes.length === 0
            ? "No recipes yet. Add the first one — a dish with a few ingredients is already useful; the method can come later."
            : "Nothing matches that search."}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {filtered.map((recipe) => (
            <li key={recipe.id} className="rounded-2xl border border-ink/10 bg-white">
              <button
                onClick={() => { setOpenId(openId === recipe.id ? null : recipe.id); setEditing(null); }}
                aria-expanded={openId === recipe.id}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-bold">{recipe.title}</span>
                  <span className="mt-0.5 block text-xs text-ink/55">
                    {recipe.category || "—"} · {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? "" : "s"}
                    {recipe.base_unit ? ` · makes ${recipe.base_quantity} × ${recipe.base_unit}` : ""}
                  </span>
                </span>
                <span aria-hidden="true" className={`shrink-0 transition-transform ${openId === recipe.id ? "rotate-180" : ""}`}>⌄</span>
              </button>

              {openId === recipe.id && (
                editing === recipe.id
                  ? <RecipeEditor recipe={recipe} busy={busy} onCancel={() => setEditing(null)} onSave={async (patch, ingredients) => {
                      await send({ action: "update", id: recipe.id, ...patch });
                      await send({ action: "saveIngredients", id: recipe.id, ingredients });
                      setEditing(null);
                    }} />
                  : <RecipeView
                      recipe={recipe}
                      onEdit={() => setEditing(recipe.id)}
                      onDelete={canDelete ? async () => {
                        if (!window.confirm(`Delete the recipe for ${recipe.title}?`)) return;
                        await send({ action: "delete", id: recipe.id });
                        setOpenId(null);
                      } : undefined}
                    />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddRecipe({ products, busy, onCreate }: { products: AvailableProduct[]; busy: boolean; onCreate: (productId: number, baseQuantity: number, baseUnit: string) => void }) {
  const [productId, setProductId] = useState("");
  const [baseQuantity, setBaseQuantity] = useState("1");
  const [baseUnit, setBaseUnit] = useState("");

  return (
    <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs font-bold tracking-wider text-clay uppercase">New recipe</p>
      {products.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">Every dish on the menu already has a recipe.</p>
      ) : (
        <>
          {/* Only dishes without a recipe appear here — one recipe per dish. */}
          <label className="mt-3 block text-xs font-bold uppercase">Dish
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm font-medium normal-case">
              <option value="">Choose a dish…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}{product.category ? ` · ${product.category}` : ""}</option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold uppercase">This makes
              <input value={baseQuantity} onChange={(event) => setBaseQuantity(event.target.value)} inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm tabular-nums" />
            </label>
            <label className="block text-xs font-bold uppercase">Of
              <input value={baseUnit} onChange={(event) => setBaseUnit(event.target.value)} placeholder="1.5 Kg pan" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case" />
            </label>
          </div>
          <button
            disabled={!productId || busy}
            onClick={() => onCreate(Number(productId), Number(baseQuantity) || 1, baseUnit)}
            className="focus-ring mt-4 w-full rounded-full bg-ink px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40"
          >
            Create and add ingredients
          </button>
        </>
      )}
    </div>
  );
}

function RecipeView({ recipe, onEdit, onDelete }: { recipe: Recipe; onEdit: () => void; onDelete?: () => void }) {
  const base = Number(recipe.base_quantity) || 1;
  const [making, setMaking] = useState(base);
  // The whole point of the tool: write it once, scale it on the day.
  const factor = base > 0 ? making / base : 1;

  return (
    <div className="border-t border-ink/10 p-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-cream p-3">
        <span className="text-xs font-bold tracking-wider uppercase">Making</span>
        <div className="flex items-center rounded-full border border-ink/20 bg-white">
          <button onClick={() => setMaking((v) => Math.max(base / 2, Number((v - base).toFixed(3))))} className="focus-ring flex size-10 items-center justify-center rounded-full text-lg" aria-label="Fewer">−</button>
          <span className="min-w-12 text-center text-sm font-bold tabular-nums">{Number(making.toFixed(2))}</span>
          <button onClick={() => setMaking((v) => Number((v + base).toFixed(3)))} className="focus-ring flex size-10 items-center justify-center rounded-full text-lg" aria-label="More">+</button>
        </div>
        <span className="text-xs text-ink/60">{recipe.base_unit || recipe.sold_by || "portions"}</span>
        {factor !== 1 && <span className="ml-auto text-xs font-bold text-clay">×{Number(factor.toFixed(2))} the written amounts</span>}
      </div>

      {recipe.ingredients.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">No ingredients written down yet.</p>
      ) : (
        <ul className="mt-4">
          {recipe.ingredients.map((ingredient, index) => {
            const quantity = ingredient.quantity == null ? null : Number(ingredient.quantity) * factor;
            return (
              <li key={ingredient.id ?? index} className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2.5 last:border-0">
                <span className="min-w-0">
                  <span className="font-semibold">{ingredient.name}</span>
                  {ingredient.note && <span className="block text-xs text-ink/55">{ingredient.note}</span>}
                </span>
                <span className="shrink-0 text-right font-bold tabular-nums">
                  {/* "To taste" has no number and must never be multiplied. */}
                  {quantity == null ? <span className="text-ink/50 italic">to taste</span> : `${Number(quantity.toFixed(2))} ${ingredient.unit || ""}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {recipe.method && (
        <div className="mt-4">
          <p className="text-xs font-bold tracking-wider text-clay uppercase">Method</p>
          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{recipe.method}</p>
        </div>
      )}
      {recipe.notes && <p className="mt-3 rounded-xl bg-honey/20 p-3 text-sm leading-6">{recipe.notes}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={onEdit} className="focus-ring flex-1 rounded-full border border-ink/20 px-4 py-3 text-xs font-bold">Edit</button>
        {onDelete && <button onClick={onDelete} className="focus-ring rounded-full border border-red-300 px-4 py-3 text-xs font-bold text-red-700">Delete</button>}
      </div>
    </div>
  );
}

function RecipeEditor({ recipe, busy, onCancel, onSave }: {
  recipe: Recipe; busy: boolean; onCancel: () => void;
  onSave: (patch: Record<string, unknown>, ingredients: Ingredient[]) => void;
}) {
  const [baseQuantity, setBaseQuantity] = useState(String(recipe.base_quantity ?? 1));
  const [baseUnit, setBaseUnit] = useState(recipe.base_unit || "");
  const [method, setMethod] = useState(recipe.method || "");
  const [notes, setNotes] = useState(recipe.notes || "");
  const [rows, setRows] = useState<Ingredient[]>(
    recipe.ingredients.length ? recipe.ingredients.map((i) => ({ ...i })) : [{ name: "", quantity: "", unit: "", note: "" }],
  );

  function update(index: number, patch: Partial<Ingredient>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="border-t border-ink/10 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold uppercase">This makes
          <input value={baseQuantity} onChange={(e) => setBaseQuantity(e.target.value)} inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm tabular-nums" />
        </label>
        <label className="block text-xs font-bold uppercase">Of
          <input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} placeholder="1.5 Kg pan" className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case" />
        </label>
      </div>

      <p className="mt-5 text-xs font-bold tracking-wider text-clay uppercase">Ingredients</p>
      <p className="mt-1 text-xs text-ink/55">Amounts for one batch as described above. Leave the amount blank for “to taste”.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="grid grid-cols-[1fr_4.5rem_4.5rem_2.75rem] gap-2">
            <input value={row.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Ingredient" className="h-11 min-w-0 rounded-xl border border-ink/20 px-3 text-sm" />
            <input value={row.quantity == null ? "" : String(row.quantity)} onChange={(e) => update(index, { quantity: e.target.value })} inputMode="decimal" placeholder="Qty" className="h-11 min-w-0 rounded-xl border border-ink/20 px-2 text-sm tabular-nums" />
            <input value={row.unit || ""} onChange={(e) => update(index, { unit: e.target.value })} placeholder="Unit" className="h-11 min-w-0 rounded-xl border border-ink/20 px-2 text-sm" />
            <button onClick={() => setRows((c) => c.filter((_, i) => i !== index))} aria-label="Remove ingredient" className="focus-ring h-11 rounded-xl border border-ink/20 text-sm">×</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setRows((c) => [...c, { name: "", quantity: "", unit: "", note: "" }])} className="focus-ring mt-2 rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold">
        Add ingredient
      </button>

      <label className="mt-5 block text-xs font-bold uppercase">Method
        <textarea value={method} onChange={(e) => setMethod(e.target.value)} rows={5} placeholder="How it is made, step by step." className="mt-1 w-full rounded-xl border border-ink/20 p-3 text-sm normal-case" />
      </label>
      <label className="mt-3 block text-xs font-bold uppercase">Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth knowing — substitutions, what to watch for." className="mt-1 w-full rounded-xl border border-ink/20 p-3 text-sm normal-case" />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          onClick={() => onSave(
            { baseQuantity: Number(baseQuantity) || 1, baseUnit, method, notes },
            rows.filter((row) => row.name.trim()),
          )}
          className="focus-ring flex-1 rounded-full bg-ink px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save recipe"}
        </button>
        <button onClick={onCancel} className="focus-ring rounded-full border border-ink/20 px-4 py-3.5 text-sm font-bold">Cancel</button>
      </div>
    </div>
  );
}
