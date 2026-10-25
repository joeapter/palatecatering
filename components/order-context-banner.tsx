"use client";
import { useStorefront } from "./storefront-provider";

/**
 * The strip along the top of every ordering page: which date this basket is
 * for, how it arrives, and when ordering closes.
 *
 * The cutoff is rendered in Israel time explicitly. Left to the browser it used
 * the reader's own timezone, so a daughter ordering from New York was told her
 * deadline was 16:59 when the kitchen's is 23:59 — the same mistake the custom
 * date route takes care to avoid on the server.
 */
export function OrderContextBanner() {
  const { orderContext, openOrderChooser } = useStorefront();

  if (!orderContext) {
    return (
      <button onClick={openOrderChooser} className="w-full bg-honey px-5 py-3 text-center text-xs font-bold text-ink">
        Choose your order date and pickup or delivery details to begin →
      </button>
    );
  }

  const cutoff = new Date(orderContext.orderWindow.cutoff_at);
  const cutoffLabel = cutoff.toLocaleString("en-IL", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Jerusalem",
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-honey px-5 py-3 text-center text-xs font-bold text-ink">
      <span>Ordering for {orderContext.orderWindow.name}</span>
      <span>·</span>
      <span>{orderContext.fulfillment === "pickup" ? "Pickup in Beit Shemesh" : `Delivery to ${orderContext.deliveryZone?.name || "— choose an area"}`}</span>
      <span>·</span>
      <span>Order by {cutoffLabel} (Israel time)</span>
      <button onClick={openOrderChooser} className="underline underline-offset-4">Edit</button>
    </div>
  );
}
