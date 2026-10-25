"use client";

import { useEffect, useRef, useState } from "react";
import { useStorefront } from "@/components/storefront-provider";

/**
 * Runs on the thank-you page when Stripe sends the customer back via redirect
 * (3-D Secure and other authenticated payment methods). In that flow the
 * checkout form never gets to call /api/checkout/complete, so without this the
 * order would depend entirely on the webhook.
 *
 * Completion is idempotent server-side, so it is safe for this to race the
 * webhook or run twice.
 */
export function CheckoutFinalizer({ paymentIntentId }: { paymentIntentId: string }) {
  const { clearCart } = useStorefront();
  const [state, setState] = useState<"working" | "done" | "attention">("working");
  const started = useRef(false);

  useEffect(() => {
    if (!paymentIntentId || started.current) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/checkout/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });
        if (cancelled) return;
        if (response.ok) {
          clearCart();
          setState("done");
        } else {
          // The webhook is still expected to pick this up; tell the customer
          // their payment landed rather than implying the order was lost.
          setState("attention");
        }
      } catch {
        if (!cancelled) setState("attention");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentIntentId, clearCart]);

  if (state === "working") {
    return <p className="mt-5 text-sm text-ink/55">Confirming your order…</p>;
  }
  if (state === "attention") {
    return (
      <p className="mt-5 rounded-xl bg-honey/20 px-4 py-3 text-sm text-ink/75">
        Your payment went through. We are still finishing the confirmation — if you
        do not receive an email shortly, contact us on 058-728-0062 with reference{" "}
        <span className="font-mono font-semibold">{paymentIntentId.slice(-12)}</span>.
      </p>
    );
  }
  return null;
}
