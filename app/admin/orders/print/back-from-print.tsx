"use client";

/**
 * A way back from a printout.
 *
 * Inside an installed app the sheet opens in place rather than a new tab —
 * there is no tab to close and no browser back button on screen, so without
 * this the only way out is to quit the app and reopen it.
 *
 * Uses history when there is somewhere to go back to, since that returns to the
 * order list with its selection intact, and falls back to the kitchen otherwise.
 */
export function BackFromPrint() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/kitchen";
      }}
      className="no-print rounded-full border border-black/20 px-4 py-2.5 text-xs font-bold"
    >
      Back
    </button>
  );
}
