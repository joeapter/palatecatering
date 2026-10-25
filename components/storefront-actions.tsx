"use client";

import { useStorefront } from "./storefront-provider";

/**
 * Header actions.
 *
 * On a phone these were two text buttons — "Cart" and "Begin order" — which
 * together ran wider than the space left beside the logo. The cart becomes an
 * icon with a count badge, and "Begin order" drops out entirely: the honey
 * banner under the header and the nav sheet both already offer it, so a third
 * copy only cost width.
 */
export function StorefrontActions() {
  const { cart, orderContext, setCartOpen, openOrderChooser } = useStorefront();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={openOrderChooser}
        className="focus-ring hidden rounded-full bg-ink px-5 py-3 text-xs font-bold text-white transition hover:bg-clay lg:block"
      >
        {orderContext ? "Edit order" : "Begin order"}
      </button>
      <button
        onClick={() => setCartOpen(true)}
        className="focus-ring relative flex size-11 items-center justify-center rounded-full border border-ink/20 lg:size-auto lg:px-4 lg:py-3"
        aria-label={count === 1 ? "Cart, 1 item" : `Cart, ${count} items`}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5 lg:hidden">
          <path d="M6 7h12l-1.2 11.1a2 2 0 0 1-2 1.9H9.2a2 2 0 0 1-2-1.9L6 7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 7a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span className="hidden text-xs font-bold lg:inline">Cart{count > 0 ? ` (${count})` : ""}</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-clay px-1.5 text-[11px] font-bold text-white tabular-nums lg:hidden">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
