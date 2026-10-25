"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type Slide = {
  id: number;
  eyebrow: string;
  headline: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  active: boolean;
  sort_order: number;
};
type ContentRow = {
  key: string; page: string; label: string; help: string;
  type: "text" | "longtext" | "image"; value: string; sort_order: number;
};

async function send(body: unknown) {
  const response = await fetch("/api/admin/design", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not save.");
  return data;
}

export function DesignManager() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [images, setImages] = useState<string[]>([]);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"hero" | "text" | "features">("hero");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/design").then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setSlides(data.slides || []);
      setContent(data.content || []);
      setFlags(data.flags || {});
      setImages(data.images || []);
      setDirty({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function run(body: unknown, message = "Saved") {
    setError(""); setStatus("");
    try { await send(body); await load(); setStatus(message); setTimeout(() => setStatus(""), 2500); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
  }

  const pages = useMemo(() => [...new Set(content.map((row) => row.page))], [content]);
  const dirtyCount = Object.keys(dirty).length;

  if (loading) return <p className="text-sm text-ink/55">Loading…</p>;

  return (
    <div>
      {error && <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
      {status && <p className="mb-5 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{status}</p>}

      <div className="mb-7 flex flex-wrap rounded-full bg-ink/5 p-1">
        {([["hero","Hero slides"],["text","Page text"],["features","Show / hide sections"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-full px-5 py-2 text-sm font-bold ${tab === value ? "bg-ink text-white" : "text-ink/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "hero" && (
        <div className="space-y-5">
          <button
            onClick={() => run({ action: "createSlide" }, "Slide added")}
            className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white"
          >
            Add a slide
          </button>
          {slides.map((slide) => (
            <SlideEditor key={slide.id} slide={slide} images={images} onRun={run} />
          ))}
          {slides.length === 0 && <p className="text-sm text-ink/55">No slides yet.</p>}
        </div>
      )}

      {tab === "text" && (
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button
              disabled={dirtyCount === 0}
              onClick={() =>
                run(
                  { action: "saveContent", entries: Object.entries(dirty).map(([key, value]) => ({ key, value })) },
                  `Saved ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`,
                )
              }
              className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {dirtyCount ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}` : "No changes"}
            </button>
            {dirtyCount > 0 && (
              <button onClick={() => setDirty({})} className="text-sm underline">Discard</button>
            )}
          </div>

          {pages.map((page) => (
            <section key={page} className="mb-9">
              <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">{page}</h2>
              <div className="mt-3 space-y-4">
                {content.filter((row) => row.page === page).map((row) => (
                  <div key={row.key} className="rounded-2xl border border-ink/10 bg-white p-5">
                    <label className="block">
                      <span className="text-sm font-bold">{row.label}</span>
                      {row.help && <span className="mt-0.5 block text-xs text-ink/50">{row.help}</span>}
                      {row.type === "longtext" ? (
                        <textarea
                          defaultValue={row.value}
                          onChange={(event) => setDirty((d) => ({ ...d, [row.key]: event.target.value }))}
                          className="mt-3 min-h-24 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          defaultValue={row.value}
                          onChange={(event) => setDirty((d) => ({ ...d, [row.key]: event.target.value }))}
                          className="mt-3 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm"
                        />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "features" && (
        <div className="space-y-4">
          {[
            { key: "packages_enabled", label: "Packages", help: "Shows the Packages link in the menu and the /packages page. Turn off to hide packages from customers entirely." },
            { key: "holidays_enabled", label: "Holiday menus", help: "Shows the Holidays link and holiday landing pages." },
          ].map((flag) => (
            <label key={flag.key} className="flex items-start gap-4 rounded-2xl border border-ink/10 bg-white p-5">
              <input
                type="checkbox"
                checked={flags[flag.key] !== false}
                onChange={(event) => run({ action: "setFlag", key: flag.key, value: event.target.checked }, "Updated")}
                className="mt-1"
              />
              <span>
                <b className="block">{flag.label}</b>
                <span className="mt-1 block text-sm text-ink/60">{flag.help}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideEditor({
  slide, images, onRun,
}: {
  slide: Slide;
  images: string[];
  onRun: (body: unknown, message?: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const field = "mt-2 w-full rounded-lg border border-ink/20 px-3 py-2 text-sm";
  const label = "block text-xs font-bold tracking-wider text-ink/50 uppercase";

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#e9e4d9]">
            {slide.image_url ? (
              <Image src={slide.image_url} alt="" fill className="object-cover" sizes="220px" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink/40">No image</div>
            )}
          </div>
          <button
            onClick={() => setPicking((value) => !value)}
            className="mt-2 w-full rounded-full border border-ink/20 px-4 py-2 text-xs font-bold"
          >
            {picking ? "Close picker" : "Change photo"}
          </button>
          <p className="mt-1 truncate text-[10px] text-ink/40">{slide.image_url || "—"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Eyebrow
            <input defaultValue={slide.eyebrow || ""} onBlur={(e) => e.target.value !== slide.eyebrow && onRun({ action: "saveSlide", id: slide.id, eyebrow: e.target.value })} className={field} />
          </label>
          <label className={label}>
            Order
            <input type="number" defaultValue={slide.sort_order} onBlur={(e) => Number(e.target.value) !== slide.sort_order && onRun({ action: "saveSlide", id: slide.id, sortOrder: Number(e.target.value) })} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Headline
            <input defaultValue={slide.headline || ""} onBlur={(e) => e.target.value !== slide.headline && onRun({ action: "saveSlide", id: slide.id, headline: e.target.value })} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Body
            <textarea defaultValue={slide.body || ""} onBlur={(e) => e.target.value !== slide.body && onRun({ action: "saveSlide", id: slide.id, body: e.target.value })} className={`${field} min-h-20`} />
          </label>
          <label className={label}>
            Button label
            <input defaultValue={slide.cta_label || ""} onBlur={(e) => e.target.value !== slide.cta_label && onRun({ action: "saveSlide", id: slide.id, ctaLabel: e.target.value })} className={field} />
          </label>
          <label className={label}>
            Button link
            <input defaultValue={slide.cta_href || ""} onBlur={(e) => e.target.value !== slide.cta_href && onRun({ action: "saveSlide", id: slide.id, ctaHref: e.target.value })} className={field} />
          </label>

          <div className="flex items-center gap-5 sm:col-span-2">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={slide.active} onChange={(e) => onRun({ action: "saveSlide", id: slide.id, active: e.target.checked })} />
              Show on the site
            </label>
            <button
              onClick={() => { if (confirm(`Delete the "${slide.headline}" slide?`)) onRun({ action: "deleteSlide", id: slide.id }, "Slide deleted"); }}
              className="text-xs font-semibold text-red-700 underline"
            >
              Delete slide
            </button>
          </div>
        </div>
      </div>

      {picking && (
        <div className="mt-5 max-h-72 overflow-y-auto rounded-xl border border-ink/10 bg-[#faf9f6] p-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {images.map((src) => (
              <button
                key={src}
                onClick={() => { onRun({ action: "saveSlide", id: slide.id, imageUrl: src }, "Photo updated"); setPicking(false); }}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 ${slide.image_url === src ? "border-honey" : "border-transparent"}`}
                title={src}
              >
                <Image src={src} alt="" fill className="object-cover" sizes="120px" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
