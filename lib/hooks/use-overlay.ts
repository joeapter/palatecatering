"use client";

import { useEffect, useRef } from "react";

/**
 * Three overlays can be open in sequence on a phone — the nav sheet, the cart
 * sheet and the order chooser — and the cart opens *while* the chooser is
 * closing. A plain "lock on open, unlock on close" pair would let the closing
 * one strip the lock the opening one just took, dropping the page back to the
 * top mid-interaction. Counting holders instead makes the lock safe to nest.
 */
let holders = 0;
let restoreTo = 0;

function lock() {
  if (holders++ > 0) return;
  restoreTo = window.scrollY;
  document.body.dataset.scrollLocked = "";
  document.body.style.top = `-${restoreTo}px`;
}

function unlock() {
  if (holders === 0 || --holders > 0) return;
  delete document.body.dataset.scrollLocked;
  document.body.style.top = "";
  // Jumping back has to skip the smooth-scroll declared on <html>, or the page
  // visibly glides to where the reader already was.
  const html = document.documentElement;
  const behaviour = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  window.scrollTo(0, restoreTo);
  html.style.scrollBehavior = behaviour;
}

/**
 * Freezes the page behind an overlay and wires Escape to close it. Returns
 * nothing; callers keep their own open state.
 */
export function useOverlay(open: boolean, onClose: () => void) {
  // Callers pass an inline arrow, so a dependency on `onClose` would tear the
  // lock down and rebuild it on every render — and the rebuild restores scroll
  // position, which reads as the page twitching under the sheet. The ref keeps
  // the effect keyed to `open` alone while still calling the latest handler.
  const handler = useRef(onClose);
  handler.current = onClose;

  useEffect(() => {
    if (!open) return;
    lock();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open]);
}
