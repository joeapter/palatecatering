"use client";

import { useState } from "react";
import { useStorefront, type CartBundle } from "./storefront-provider";

export function BundleAddButton({ bundle }: { bundle: CartBundle }) {
  const { addBundle } = useStorefront();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      <div className="flex items-center rounded-full border border-ink/20 bg-white">
        <button
          type="button"
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          className="px-4 py-3 text-lg"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="min-w-10 text-center text-sm font-semibold" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((value) => value + 1)}
          className="px-4 py-3 text-lg"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          addBundle(bundle, quantity);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
        className="rounded-full bg-ink px-7 py-4 text-sm font-bold text-white transition hover:bg-moss"
      >
        {added ? "Added to cart" : "Add package to cart"}
      </button>
    </div>
  );
}
