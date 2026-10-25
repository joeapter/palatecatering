"use client";

import { usePathname } from "next/navigation";
import { useStorefront } from "./storefront-provider";

/**
 * The standing cart bar at the bottom of the screen on phones.
 *
 * Without it the only route to the cart was the header, which means scrolling
 * back up the length of a category page after every dish. It appears as soon
 * as something is in the cart and stays out of the way until then.
 *
 * Suppressed on /checkout, where the page itself is the order summary and a
 * floating "view cart" would send the reader backwards.
 */
export function MobileOrderBar() {
  const { cart, setCartOpen } = useStorefront();
  const pathname = usePathname();

  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (!count || pathname === "/checkout") return null;

  return (
    <>
      {/* Holds open the same height as the fixed bar so it can never cover the
          last row of the footer. */}
      <div aria-hidden="true" className="h-[4.75rem] lg:hidden" />
      <div className="pb-safe fixed inset-x-0 bottom-0 z-[60] border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="focus-ring flex w-full items-center justify-between gap-3 rounded-full bg-ink px-5 py-4 text-white"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="flex min-w-6 items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">
              {count}
            </span>
            View cart
          </span>
          <span className="text-sm font-bold tabular-nums">₪{subtotal.toFixed(2)}</span>
        </button>
      </div>
    </>
  );
}
