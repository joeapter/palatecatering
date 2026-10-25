"use client";

import { useCallback, useEffect, useState } from "react";

type Window = {
  id: number;
  name: string;
  event_date: string;
  cutoff_at: string;
  active: boolean;
  order_count: number;
};

export function WindowsManager() {
  const [windows, setWindows] = useState<Window[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", eventDate: "", cutoffAt: "" });

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/windows").then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setWindows(data.windows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order windows.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function send(body: unknown) {
    setError("");
    const response = await fetch("/api/admin/windows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not save."); return false; }
    await load();
    return true;
  }

  if (loading) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
      )}

      <form
        className="mb-10 grid gap-4 rounded-2xl border border-ink/10 bg-white p-5 sm:grid-cols-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await send({ action: "create", ...form });
          if (ok) setForm({ name: "", eventDate: "", cutoffAt: "" });
        }}
      >
        <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Shabbos · 28 Aug"
            className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
          Event date
          <input
            required
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-xs font-bold tracking-wider text-ink/50 uppercase">
          Orders close
          <input
            required
            type="datetime-local"
            value={form.cutoffAt}
            onChange={(e) => setForm({ ...form, cutoffAt: e.target.value })}
            className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal"
          />
        </label>
        <button className="self-end rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
          Add window
        </button>
      </form>

      <div className="rail overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-ink/10 text-left text-xs tracking-wider text-ink/50 uppercase">
            <tr>
              <th className="px-5 py-3">Window</th>
              <th className="px-5 py-3">Event</th>
              <th className="px-5 py-3">Closes</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Open</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => {
              const closed = new Date(w.cutoff_at) <= new Date();
              return (
                <tr key={w.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-5 py-3 font-semibold">{w.name}</td>
                  <td className="px-5 py-3 text-ink/60">
                    {new Date(`${w.event_date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className={`px-5 py-3 ${closed ? "text-ink/40" : ""}`}>
                    {new Date(w.cutoff_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    {closed && " · closed"}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{w.order_count}</td>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={w.active}
                      onChange={(e) => send({ action: "update", id: w.id, active: e.target.checked })}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        const msg = w.order_count > 0
                          ? `"${w.name}" has ${w.order_count} orders, so it will be closed rather than deleted. Continue?`
                          : `Delete "${w.name}"?`;
                        if (confirm(msg)) send({ action: "delete", id: w.id });
                      }}
                      className="text-xs font-semibold text-red-700 underline"
                    >
                      {w.order_count > 0 ? "Close" : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
