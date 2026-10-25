"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: number;
  category: string;
  title: string;
  description: string;
  price: string;
  sold_by: string;
  active: boolean;
};

export function PricingQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/pricing").then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setRows(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function send(body: unknown) {
    setError("");
    const response = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not save."); return; }
    await load();
  }

  if (loading) return <p className="text-sm text-ink/55">Loading…</p>;

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
        <p className="font-semibold">Nothing waiting on a price.</p>
        <p className="mt-2 text-sm text-ink/55">
          Items appear here when a price was generated rather than set by you. They stay off
          the menu until you confirm them.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      )}
      <div className="space-y-4">
        {rows.map((row) => (
          <PriceRow key={row.id} row={row} onSend={send} />
        ))}
      </div>
    </div>
  );
}

function PriceRow({ row, onSend }: { row: Row; onSend: (body: unknown) => Promise<void> }) {
  const [price, setPrice] = useState(String(Number(row.price).toFixed(0)));
  const [soldBy, setSoldBy] = useState(row.sold_by || "");
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-2xl border border-honey bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-56 flex-1">
          <p className="text-xs font-bold tracking-wider text-clay uppercase">{row.category}</p>
          <p className="mt-1 text-lg font-bold">{row.title}</p>
          {row.description && <p className="mt-1 text-sm text-ink/55">{row.description}</p>}
          <p className="mt-2 text-xs text-ink/45">
            Suggested ₪{Number(row.price).toFixed(0)} — not confirmed, so this item is hidden
            from customers.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
            Sold by
            <input
              value={soldBy}
              onChange={(event) => setSoldBy(event.target.value)}
              className="mt-2 w-36 rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
            />
          </label>
          <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
            Price ₪
            <input
              type="number"
              min={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-2 w-28 rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal"
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSend({ id: row.id, price: Number(price), soldBy });
              setBusy(false);
            }}
            className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Confirm &amp; publish
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Remove "${row.title}"? It will stay off the menu.`)) return;
              setBusy(true);
              await onSend({ id: row.id, action: "reject" });
              setBusy(false);
            }}
            className="text-xs font-semibold text-red-700 underline"
          >
            We don&rsquo;t sell this
          </button>
        </div>
      </div>
    </section>
  );
}
