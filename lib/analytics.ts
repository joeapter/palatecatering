"use client";

/**
 * The handful of shop events worth measuring.
 *
 * Page views alone tell you traffic went up; these tell you whether it turned
 * into orders, and where people stopped. That is the difference between GA4
 * being a vanity number and something that answers "is the Rosh Hashanah menu
 * actually selling".
 *
 * Every call is a no-op when analytics is not configured, so nothing here needs
 * guarding at the call site and the shop works identically with it switched off.
 */

type GtagArgs = [command: string, ...rest: unknown[]];
type WindowWithGtag = Window & { gtag?: (...args: GtagArgs) => void };

function send(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const gtag = (window as WindowWithGtag).gtag;
  // Absent until the measurement id is set, and disabled by the kill switch on
  // admin paths. Both are silent by design.
  if (typeof gtag !== "function") return;
  try {
    gtag("event", event, params);
  } catch {
    // Analytics must never be able to break a checkout.
  }
}

export type AnalyticsItem = {
  id?: number | string;
  title: string;
  price: number;
  quantity?: number;
  variant?: string | null;
  category?: string | null;
};

function toGa(item: AnalyticsItem) {
  return {
    item_id: String(item.id ?? item.title),
    item_name: item.title,
    item_variant: item.variant || undefined,
    item_category: item.category || undefined,
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
  };
}

export function trackAddToCart(item: AnalyticsItem) {
  send("add_to_cart", {
    currency: "ILS",
    value: (Number(item.price) || 0) * (Number(item.quantity) || 1),
    items: [toGa(item)],
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number) {
  send("begin_checkout", { currency: "ILS", value, items: items.map(toGa) });
}

/**
 * A completed order. Sent with the order number as the transaction id so GA4
 * de-duplicates if the thank-you page is reloaded or shared.
 */
export function trackPurchase(orderNumber: string | number, value: number, items: AnalyticsItem[]) {
  send("purchase", {
    transaction_id: String(orderNumber),
    currency: "ILS",
    value,
    items: items.map(toGa),
  });
}
