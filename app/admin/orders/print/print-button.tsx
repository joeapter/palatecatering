"use client";

/**
 * Print.
 *
 * The sheet is opened with window.open by every button that leads here, which
 * is the one way an installed home-screen app gives a context where printing
 * works — so window.print() is used unconditionally and needs no special case.
 *
 * There was briefly a second button producing a server-rendered PDF, for the
 * case where printing appeared broken. It is gone: the browser's own rendering
 * of this page is better looking than anything redrawn by hand, and on a phone
 * the print dialog's Save to Files already produces a PDF of exactly what is on
 * screen. A second, worse PDF was not worth keeping.
 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
    >
      Print packet
    </button>
  );
}
