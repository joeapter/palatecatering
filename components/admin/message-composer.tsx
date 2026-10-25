"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TEMPLATES, PLACEHOLDER_HELP, defaultFor, renderTemplate, type StoredTemplate } from "@/lib/notifications/templates";
import type { MessageKind } from "@/lib/notifications/messages";

/**
 * Where the wording of every customer message is written.
 *
 * Each one shows a live preview filled with a realistic order, because the
 * thing that matters is not the template but the sentence a customer actually
 * receives — placeholders make that hard to picture, and a message read only as
 * `{name}` and `{window}` is a message nobody has really checked.
 */
export function MessageComposer() {
  const [templates, setTemplates] = useState<StoredTemplate[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StoredTemplate>>({});
  const [saving, setSaving] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/messages");
      if (!response.ok) throw new Error("Could not load messages.");
      const data = await response.json();
      setTemplates(data.templates || []);
      setDrafts(Object.fromEntries((data.templates || []).map((t: StoredTemplate) => [t.key, { ...t }])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load messages.");
      setTemplates([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function edit(key: string, patch: Partial<StoredTemplate>) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    setSaved("");
  }

  async function save(key: string) {
    const draft = drafts[key];
    if (!draft) return;
    setSaving(key); setError(""); setSaved("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That message could not be saved.");
      await load();
      setSaved(key);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That message could not be saved.");
    } finally {
      setSaving("");
    }
  }

  if (templates === null) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {DEFAULT_TEMPLATES.map((meta) => {
        const draft = drafts[meta.key] || { key: meta.key, label: meta.label, body: meta.body, enabled: true };
        const original = defaultFor(meta.key as MessageKind);
        const changed = draft.body !== (templates.find((t) => t.key === meta.key)?.body ?? meta.body)
          || draft.label !== (templates.find((t) => t.key === meta.key)?.label ?? meta.label)
          || draft.enabled !== (templates.find((t) => t.key === meta.key)?.enabled ?? true);

        // A realistic order, so the preview reads like something a customer got.
        const preview = renderTemplate(draft.body, {
          orderNumber: 1682,
          customerName: "Aliza Mitnick",
          windowLabel: "Shabbos · Aug 21",
          total: "710",
        });

        return (
          <section key={meta.key} className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{meta.label}</h2>
                <p className="mt-1 text-xs leading-5 text-ink/60">{meta.description}</p>
              </div>
              {/* Only the seasonal announcement is worth switching off; the rest
                  are part of the ordinary order flow. */}
              {meta.key === "holiday_menu" && (
                <label className="flex shrink-0 items-center gap-2 text-xs font-bold">
                  <input type="checkbox" checked={draft.enabled} onChange={(e) => edit(meta.key, { enabled: e.target.checked })} className="size-5" />
                  Show the button
                </label>
              )}
            </div>

            <label className="mt-4 block text-xs font-bold uppercase">Button text
              <input
                value={draft.label}
                onChange={(e) => edit(meta.key, { label: e.target.value })}
                maxLength={30}
                className="mt-1 h-11 w-full rounded-xl border border-ink/20 px-3 text-sm normal-case"
              />
            </label>

            <label className="mt-3 block text-xs font-bold uppercase">Message
              <textarea
                value={draft.body}
                onChange={(e) => edit(meta.key, { body: e.target.value })}
                rows={7}
                className="mt-1 w-full rounded-xl border border-ink/20 p-3 text-sm leading-6 normal-case"
              />
            </label>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {meta.placeholders.map((placeholder) => (
                <button
                  key={placeholder}
                  type="button"
                  title={PLACEHOLDER_HELP[placeholder]}
                  onClick={() => edit(meta.key, { body: `${draft.body}{${placeholder}}` })}
                  className="rounded-full border border-ink/20 px-2.5 py-1.5 text-[11px] font-bold"
                >
                  {"{" + placeholder + "}"}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-cream p-3">
              <p className="text-[10px] font-bold tracking-wider text-clay uppercase">What the customer receives</p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{preview}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => save(meta.key)}
                disabled={!changed || saving === meta.key}
                className="focus-ring rounded-full bg-ink px-5 py-3 text-xs font-bold text-white disabled:opacity-35"
              >
                {saving === meta.key ? "Saving…" : changed ? "Save" : "Saved"}
              </button>
              {draft.body !== original.body && (
                <button
                  onClick={() => edit(meta.key, { body: original.body, label: original.label })}
                  className="focus-ring rounded-full border border-ink/20 px-4 py-3 text-xs font-bold"
                >
                  Restore the original
                </button>
              )}
              {saved === meta.key && <span className="text-xs font-bold text-moss">Saved — it is in use now.</span>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
