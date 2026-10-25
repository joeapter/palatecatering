"use client";

import { useEffect } from "react";

/**
 * Guarantees every printed sheet fits on exactly one page.
 *
 * A kitchen sheet that runs onto a second page is worse than a small one: staff
 * work from a stack of them, and a stray page two gets separated from its order
 * or thrown away with the header still on page one. A short order was also
 * producing a blank second sheet, which wasted paper and made the stack
 * untrustworthy.
 *
 * Scaling is done by shrinking the type until the content fits, rather than by
 * a CSS transform. A transform is unreliable across print engines and can crop;
 * reflowing at a smaller size prints predictably on any printer.
 */

/**
 * A4 at 96dpi less the 8mm @page margins, then a small safety margin. Printers
 * disagree slightly about the imageable area, and being a few millimetres under
 * costs nothing while being over costs a whole extra sheet.
 */
const PAGE_HEIGHT_PX = Math.floor(((297 - 16) / 25.4) * 96) - 24;
/** Browser default root size, and the smallest that stays readable in a kitchen. */
const BASE_ROOT_PX = 16;
const MIN_ROOT_PX = 8.5;

/**
 * Shrinks the root font size until the tallest sheet fits a page.
 *
 * The root, not each sheet: these sheets are laid out with utility classes
 * whose sizes are in `rem`, which resolve against the root and ignore a parent
 * font-size entirely. Setting it on the sheet moved nothing — a 21-item kitchen
 * sheet still ran to two pages while appearing to have been scaled.
 *
 * One size for the whole batch rather than per sheet. A stack of kitchen sheets
 * in mixed type sizes reads as a mistake, and the tallest order is the one that
 * decides the constraint anyway.
 */
function fitAll() {
  const sheets = [...document.querySelectorAll<HTMLElement>(".print-sheet")];
  if (!sheets.length) return;

  const tallest = () => Math.max(...sheets.map((sheet) => sheet.scrollHeight));

  let root = BASE_ROOT_PX;
  document.documentElement.style.fontSize = `${root}px`;
  while (tallest() > PAGE_HEIGHT_PX && root > MIN_ROOT_PX) {
    root -= 0.5;
    document.documentElement.style.fontSize = `${root}px`;
  }
}

export function FitToPage() {
  useEffect(() => {
    // Fonts change the measurement, so wait for them where supported.
    const run = () => requestAnimationFrame(fitAll);
    if (document.fonts?.ready) document.fonts.ready.then(run);
    else run();

    // Safari and Chrome both fire this before rendering the print preview,
    // which covers "print" from the browser menu as well as our own button.
    window.addEventListener("beforeprint", fitAll);
    // iOS Safari does not always fire beforeprint; the media query does.
    const media = window.matchMedia("print");
    const onMedia = (event: MediaQueryListEvent) => { if (event.matches) fitAll(); };
    media.addEventListener?.("change", onMedia);

    return () => {
      window.removeEventListener("beforeprint", fitAll);
      media.removeEventListener?.("change", onMedia);
    };
  }, []);

  return null;
}
