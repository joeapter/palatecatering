"use client";

import { useEffect, useState } from "react";

/**
 * Tells you when the browser is lying about the screen size.
 *
 * iOS Safari's "Request Desktop Website" makes the page believe it has a 980px
 * viewport on a 390px phone. Every tablet and desktop style then applies and is
 * scaled down, so the layout looks cramped and desktopish while the site is
 * behaving exactly as instructed. There is no way for a page to override the
 * setting, and it took several wrong guesses to identify from the outside — so
 * rather than fight it, this names it.
 *
 * The tell is the mismatch: `screen.width` still reports the real hardware
 * width even when `innerWidth` has been inflated.
 */
export function DesktopRequestHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("palate-dismissed-desktop-hint")) return;
      const physical = Math.min(window.screen.width, window.screen.height);
      const reported = window.innerWidth;
      // A genuine small tablet reports both around the same figure; only a
      // desktop request produces a wide viewport on narrow hardware.
      if (physical <= 500 && reported >= 700) setShow(true);
    } catch {
      // Storage or screen unavailable; the hint is optional.
    }
  }, []);

  if (!show) return null;

  return (
    <div className="border-b border-honey bg-honey/25 px-4 py-3 text-sm leading-6">
      <b>This browser is set to “Request Desktop Website”.</b> That is why the
      layout looks cramped — the page is being told your screen is{" "}
      {typeof window !== "undefined" ? window.innerWidth : 980}px wide. Tap{" "}
      <b>aA</b> in Safari’s address bar and choose <b>Request Mobile Website</b>, or turn it
      off under Settings → Safari → Request Desktop Website.
      <button
        onClick={() => {
          try { sessionStorage.setItem("palate-dismissed-desktop-hint", "1"); } catch {}
          setShow(false);
        }}
        className="focus-ring ml-2 rounded-full border border-ink/25 px-3 py-1 text-xs font-bold"
      >
        Dismiss
      </button>
    </div>
  );
}
