"use client";

/**
 * Opens a printable sheet in a way that can actually be printed.
 *
 * Inside an installed home-screen app the three obvious approaches behave
 * differently, and only one of them ends up printable:
 *
 *   <a target="_blank">   ignored outright — the tap does nothing at all
 *   same-window navigate  opens the sheet, but window.print() is a no-op there
 *   window.open()         opens a fresh context where printing works
 *
 * So this is a button calling window.open, not a link. That is exactly what the
 * admin's own print buttons were doing when printing worked there and not in
 * the kitchen — the difference was never the page, it was how it was opened.
 *
 * If a popup blocker returns null we fall back to navigating in place, which at
 * least shows the sheet and offers the PDF.
 */
export function openPrintSheet(href: string) {
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = href;
}

export function PrintLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openPrintSheet(href)} className={className}>
      {children}
    </button>
  );
}

/** Kept for callers that still ask; no longer used to choose behaviour. */
export function useInstalledApp() {
  return false;
}
