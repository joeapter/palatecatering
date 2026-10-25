"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStorefront } from "./storefront-provider";
import type { CartLine } from "./storefront-provider";

/**
 * Rebuilds a basket from a reminder email and sends the customer onward.
 *
 * It stops to say so when something has changed — an item withdrawn, or the
 * cutoff passed while the email sat unread — because arriving at a checkout
 * that is quietly missing two dishes is worse than being told.
 */
export function RestoreCart({ token }: { token: string }) {
  const { replaceCart, orderContext, openOrderChooser } = useStorefront();
  const router = useRouter();
  const [state, setState] = useState<"working" | "ready" | "error">("working");
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [cutoffPassed, setCutoffPassed] = useState(false);
  // Showing what came back matters: "Your basket is back" above a bare button
  // asks the customer to take our word for it, and the one thing they want to
  // know is whether it is the right basket.
  const [restored, setRestored] = useState<CartLine[]>([]);
  // Effects run twice in development; restoring twice would be harmless but the
  // duplicate request is noise.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    (async () => {
      try {
        const response = await fetch("/api/cart/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) { setMessage(data.error || "That link did not work."); setState("error"); return; }

        replaceCart(data.lines as CartLine[]);
        setRestored(data.lines as CartLine[]);
        setUnavailable(data.unavailable || []);
        setCutoffPassed(Boolean(data.cutoffPassed));
        setState("ready");

        // Nothing to report and a date already chosen: send them straight on,
        // which is the whole promise of the link.
        if (!data.unavailable?.length && !data.cutoffPassed && orderContext) {
          router.replace("/checkout");
        }
      } catch {
        setMessage("That link did not work.");
        setState("error");
      }
    })();
  }, [token, replaceCart, router, orderContext]);

  if (state === "working") {
    return <p className="text-sm text-ink/60">Restoring your basket…</p>;
  }

  if (state === "error") {
    return (
      <div className="max-w-md rounded-[1.75rem] border border-ink/10 bg-white p-8 text-center">
        <h1 className="display t-h3 font-semibold">We could not restore that basket.</h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">{message}</p>
        <Link href="/shabbos" className="focus-ring mt-6 inline-block rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-white">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[1.75rem] border border-ink/10 bg-white p-7 text-center sm:p-8">
      <h1 className="display t-h3 font-semibold">Your basket is back.</h1>

      {restored.length > 0 && (
        <ul className="mt-5 space-y-2 text-left">
          {restored.map((line) => (
            <li key={line.key} className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-2 text-sm">
              <span className="min-w-0">
                <b className="font-semibold">{line.title}</b>
                <span className="block text-xs text-ink/55">{line.quantity} × {line.variantLabel}</span>
              </span>
              <b className="shrink-0 tabular-nums">₪{(line.unitPrice * line.quantity).toFixed(2)}</b>
            </li>
          ))}
          <li className="flex justify-between pt-1 text-sm">
            <b>Total</b>
            <b className="tabular-nums">₪{restored.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0).toFixed(2)}</b>
          </li>
        </ul>
      )}

      {cutoffPassed && (
        <p className="mt-4 rounded-xl bg-honey/25 p-4 text-sm leading-6">
          Ordering for that date has closed since we emailed you — choose a new date and everything moves across.
        </p>
      )}
      {unavailable.length > 0 && (
        <p className="mt-4 rounded-xl bg-cream p-4 text-sm leading-6 text-ink/70">
          We could not bring back {unavailable.join(", ")} — {unavailable.length === 1 ? "it is" : "they are"} no longer on the menu.
        </p>
      )}

      <button
        onClick={() => (orderContext && !cutoffPassed ? router.push("/checkout") : openOrderChooser())}
        className="focus-ring mt-6 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white"
      >
        {orderContext && !cutoffPassed ? "Continue to checkout" : "Choose your date"}
      </button>
      <Link href="/shabbos" className="focus-ring mt-3 inline-block py-2 text-xs font-semibold underline underline-offset-4">
        Keep shopping
      </Link>
    </div>
  );
}
