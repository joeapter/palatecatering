"use client";

import Image from "next/image";
import { useState } from "react";
import type { StorefrontProduct } from "@/lib/storefront/types";
import { useStorefront } from "./storefront-provider";

/**
 * A dish.
 *
 * Two layouts, one component. On a phone this is a horizontal row — thumbnail
 * left, everything else right — because the vertical card with a 4:3 photo ran
 * to roughly half a screen each, and a category of twenty salatim became a very
 * long scroll with three dishes visible at a time. From `sm` up it returns to
 * the stacked card, where the photography has room to do its job.
 */
export function ProductCard({ product }: { product: StorefrontProduct }) {
  const { addProduct } = useStorefront();
  const allVariants = product.variants.length
    ? product.variants
    : [{ label: product.soldBy || "Each", soldBy: product.soldBy || "Each", price: product.price, unitType: "each" as const, unitLabel: product.soldBy || "Each", minimumQuantity: 1, quantityStep: 1 }];
  // An add-on (cholent + kishka) is its own variant so checkout and the kitchen
  // sheets need nothing special, but it reads as a tick-box on the size it
  // extends rather than a second size. One whose size is withdrawn falls back
  // to being listed as a size of its own.
  const variants = allVariants.filter((item) => !item.addonOf || !allVariants.some((base) => base.id === item.addonOf));
  const [variantIndex, setVariantIndex] = useState(0);
  const baseVariant = variants[variantIndex];
  const addon = baseVariant.id ? allVariants.find((item) => item.addonOf === baseVariant.id) : undefined;
  const [addonChosen, setAddonChosen] = useState(false);
  const variant = addon && addonChosen ? addon : baseVariant;
  const [quantity, setQuantity] = useState(variant.minimumQuantity);

  const serves = variant.servesMin
    ? ` · serves ${variant.servesMin}${variant.servesMax && variant.servesMax !== variant.servesMin ? `–${variant.servesMax}` : ""}`
    : "";

  return (
    <article className="group flex overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white sm:block">
      {/* A fixed square, not a stretch to card height. Stretching made the
          thumbnail as tall as whatever text sat beside it, so the photo was
          cropped to a narrow strip — the dish became unrecognisable. A square
          keeps the whole plate in frame and stays dense enough to scan. */}
      <div className="relative m-3 aspect-square w-32 shrink-0 self-start overflow-hidden rounded-xl bg-[#e9e4d9] sm:m-0 sm:aspect-[4/3] sm:w-auto sm:self-auto sm:rounded-none">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 128px"
          />
        ) : (
          <div className="paper-grain flex h-full items-center justify-center text-[10px] tracking-[.2em] text-ink/45 uppercase">Palate</div>
        )}
        {product.badge && (
          <span className="absolute top-2 left-2 rounded-full bg-cream px-2 py-1 text-[9px] font-bold tracking-wider uppercase sm:top-4 sm:left-4 sm:px-3 sm:py-2 sm:text-[10px]">
            {product.badge}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 py-3 pr-4 pl-1 sm:p-5">
        <h2 className="display text-xl leading-tight font-semibold sm:text-2xl">{product.title}</h2>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-ink/60 sm:mt-2 sm:min-h-10">
          {product.description || "Prepared fresh by the Palate kitchen."}
        </p>

        {variants.length > 1 && (
          <label className="mt-3 block text-[10px] font-bold tracking-wider uppercase sm:mt-4">
            <span className="sr-only sm:not-sr-only">Choose size</span>
            <select
              aria-label={`Choose size for ${product.title}`}
              value={variantIndex}
              onChange={(event) => { const index = Number(event.target.value); setVariantIndex(index); setQuantity(variants[index].minimumQuantity); }}
              className="w-full rounded-xl border border-ink/20 bg-cream px-3 py-2.5 text-xs font-semibold normal-case sm:mt-2"
            >
              {variants.map((item, index) => (
                <option key={`${item.id}-${item.label}`} value={index}>{item.label} · ₪{item.price}</option>
              ))}
            </select>
          </label>
        )}

        {addon && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-xs font-semibold sm:mt-4">
            <input
              type="checkbox"
              checked={addonChosen}
              onChange={(event) => setAddonChosen(event.target.checked)}
              className="size-4 shrink-0 accent-ink"
            />
            <span className="flex-1">Add {addon.addonLabel}</span>
            <span className="tabular-nums text-ink/60">+₪{addon.price - baseVariant.price}</span>
          </label>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-2 sm:mt-4">
          <p className="text-lg font-bold tabular-nums">₪{variant.price}</p>
          <p className="truncate text-[10px] text-ink/50">{variant.unitLabel}{serves}</p>
        </div>

        {/* Stepper and Add sit on their own row so the button can run full
            width — in the phone layout there is not enough room beside the
            price, and a wide Add is an easier target regardless. */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex shrink-0 items-center rounded-full border border-ink/15">
            <button onClick={() => setQuantity(Math.max(variant.minimumQuantity, quantity - variant.quantityStep))} className="focus-ring flex size-10 items-center justify-center rounded-full text-base" aria-label={`Fewer ${product.title}`}>−</button>
            <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
            <button onClick={() => setQuantity(Math.min(variant.maximumQuantity || Infinity, quantity + variant.quantityStep))} className="focus-ring flex size-10 items-center justify-center rounded-full text-base" aria-label={`More ${product.title}`}>+</button>
          </div>
          <button
            type="button"
            onClick={() => addProduct(product, variant, quantity)}
            className="focus-ring flex-1 rounded-full bg-ink px-4 py-3 text-xs font-bold text-white transition active:bg-clay"
          >
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
