"use client";

import { useEffect, useRef } from "react";
import { useStorefront } from "./storefront-provider";

const CART_ID_KEY = "palate-cart-id";

/**
 * Gives the cart a stable id that survives a reload, so a shopper who comes
 * back tomorrow updates the same recovery row instead of creating a second one.
 */
function cartId() {
  try {
    const existing = localStorage.getItem(CART_ID_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(CART_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

/**
 * Reports the cart to the server so an unfinished order can be followed up.
 *
 * Debounced, because the cart changes on every tap of a quantity stepper and
 * one request per tap would be both wasteful and a poor signal — what matters
 * is where the cart settled, not each keystroke on the way.
 */
export function CartRecovery() {
  const { cart, orderContext } = useStorefront();
  const timer = useRef<number | null>(null);
  const lastSent = useRef("");

  useEffect(() => {
    const id = cartId();
    if (!id) return;

    const items = cart.map((line) => ({
      title: line.title,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      variantLabel: line.variantLabel,
      productId: line.productId,
      variantId: line.variantId,
      bundleId: line.bundleId,
      image: line.image,
    }));

    // Skip identical repeats — remounts and route changes would otherwise
    // re-send the same cart on every navigation.
    const fingerprint = JSON.stringify({ items, w: orderContext?.orderWindow.id, f: orderContext?.fulfillment });
    if (fingerprint === lastSent.current) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      lastSent.current = fingerprint;
      const payload = {
        cartId: id,
        items,
        orderWindowId: orderContext?.orderWindow.id,
        windowLabel: orderContext?.orderWindow.name,
        fulfillment: orderContext?.fulfillment,
        pageUrl: window.location.pathname,
      };
      // keepalive so a cart recorded as the tab closes still reaches us —
      // which is exactly the moment a cart becomes abandoned.
      fetch("/api/cart/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }, 2500);

    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [cart, orderContext]);

  return null;
}

/** Called from checkout once an email address is known and worth storing. */
export async function attachCartContact(details: { email?: string; name?: string; phone?: string; address?: string; status?: string; orderWindowId?: number | string; windowLabel?: string; fulfillment?: string; items: unknown[] }) {
  try {
    const id = cartId();
    if (!id) return;
    await fetch("/api/cart/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartId: id, ...details }),
      keepalive: true,
    });
  } catch {
    // Recovery is a background nicety; checkout continues regardless.
  }
}

/** The cart id, for stamping onto a PaymentIntent so payment closes the loop. */
export function currentCartId() {
  return cartId();
}
