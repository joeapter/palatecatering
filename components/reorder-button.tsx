"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStorefront, type CartLine } from "./storefront-provider";

/**
 * Puts a past order back in the cart. The server re-prices every line against
 * the current catalog, so what lands in the cart is what it costs today.
 */
export function ReorderButton({ orderId }: { orderId: number }) {
  const { replaceCart, setCartOpen, orderContext, openOrderChooser } = useStorefront();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reorder() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not rebuild that order.");
        return;
      }
      const lines = (data.lines || []) as CartLine[];
      if (!lines.length) {
        setMessage("None of those items are available right now.");
        return;
      }
      replaceCart(lines);
      if (data.unavailable?.length) {
        setMessage(`Added, but unavailable now: ${data.unavailable.join(", ")}.`);
      }
      // Reordering needs a date before checkout, same as any other order.
      if (!orderContext) openOrderChooser();
      else setCartOpen(true);
      router.refresh();
    } catch {
      setMessage("Could not rebuild that order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={reorder}
        disabled={busy}
        className="rounded-full border border-ink/20 bg-white px-5 py-3 text-sm font-bold transition hover:bg-ink hover:text-white disabled:opacity-50"
      >
        {busy ? "Rebuilding…" : "Order this again"}
      </button>
      {message && <p className="mt-2 max-w-xs text-xs text-ink/60">{message}</p>}
    </div>
  );
}
