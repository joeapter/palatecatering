"use client";

import { useState } from "react";
import type { StorefrontCategory, StorefrontProduct, ProductVariant } from "@/lib/storefront/types";
import { useStorefront } from "./storefront-provider";

/**
 * Laid out to read as a continuation of the printed Rosh Hashanah menu: cream
 * ground, deep pomegranate section headings, a pomegranate bullet per dish, and
 * the two pan sizes as priced columns on the right. Deliberately no photography
 * — the printed menu has none, and adding it here would break the resemblance.
 */

/** The small italic note under each section heading, as printed. */
const SECTION_NOTES: Record<string, string> = {
  Salatim: "500g containers",
  Soups: "1-litre containers",
  Fish: "Sold by side of salmon",
  Meat: "9x13 tray",
  Chicken: "Serves 6–8",
  Sides: "9x13 tray",
  "Kugels & Savories": "9x13 tray",
};

function Pomegranate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 fill-pomegranate">
      <path d="M12 3c.5-1.2 1.6-2 2.7-2.2-.2 1.2-.8 2.1-1.7 2.6 4 .6 7 3.9 7 8 0 5-3.6 9.6-8 9.6S4 16.4 4 11.4c0-4.1 3-7.4 7-8 .3 0 .7 0 1-.4z" />
    </svg>
  );
}

/**
 * Price, then an explicit quantity box and Add button. Adding on a click of the
 * price was too easy to trigger by accident, and gave no way to order two of
 * something without clicking twice.
 */
function PriceOption({
  product,
  variant,
  onAdd,
}: {
  product: StorefrontProduct;
  variant: ProductVariant;
  onAdd: (product: StorefrontProduct, variant: ProductVariant, quantity: number) => void;
}) {
  const step = variant.quantityStep || 1;
  const minimum = variant.minimumQuantity || step;
  const [quantity, setQuantity] = useState(minimum);
  const [added, setAdded] = useState(false);

  return (
    <div className="w-32">
      <p className="text-center display text-xl leading-none text-ink tabular-nums sm:text-2xl">
        <span className="mr-1 align-[0.1em] text-sm text-pomegranate">₪</span>
        {Number(variant.price).toFixed(0)}
      </p>
      <p className="mt-1 text-center text-[10px] tracking-wide text-ink/45 uppercase sm:hidden">
        {variant.label}
      </p>

      <div className="mt-2 flex items-center justify-center rounded-md border border-rule bg-white">
        <button
          type="button"
          onClick={() => setQuantity((value) => Math.max(minimum, value - step))}
          className="focus-ring px-2 py-1 text-sm text-ink/70 disabled:opacity-30"
          disabled={quantity <= minimum}
          aria-label={`Decrease quantity of ${product.title}, ${variant.label}`}
        >
          −
        </button>
        <input
          type="number"
          min={minimum}
          step={step}
          value={quantity}
          onChange={(event) => {
            const next = Number(event.target.value);
            setQuantity(Number.isFinite(next) && next >= minimum ? next : minimum);
          }}
          aria-label={`Quantity of ${product.title}, ${variant.label}`}
          className="w-10 border-0 bg-transparent py-1 text-center text-sm tabular-nums focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setQuantity((value) => value + step)}
          className="focus-ring px-2 py-1 text-sm text-ink/70"
          aria-label={`Increase quantity of ${product.title}, ${variant.label}`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onAdd(product, variant, quantity);
          setAdded(true);
          setQuantity(minimum);
          setTimeout(() => setAdded(false), 1400);
        }}
        className="focus-ring mt-1.5 w-full rounded-md bg-pomegranate px-2 py-1.5 text-[11px] font-bold tracking-[.1em] text-white uppercase transition hover:bg-pomegranate/90"
      >
        {added ? "Added ✓" : "Add"}
      </button>
    </div>
  );
}

export function HolidayMenu({ categories }: { categories: StorefrontCategory[] }) {
  const { addProduct } = useStorefront();

  function add(product: StorefrontProduct, variant: ProductVariant, quantity: number) {
    addProduct(product, variant, quantity);
  }

  return (
    <div className="space-y-16">
      {categories.map((category) => {
        // Two-size sections get priced columns, as on the printed menu.
        const hasTwoSizes = category.products.some((product) => product.variants.length > 1);
        const columnLabels = hasTwoSizes
          ? (() => {
              const sample = category.products.find((p) => p.variants.length > 1);
              return [sample?.variants[0]?.label ?? "", sample?.variants[1]?.label ?? ""];
            })()
          : null;

        return (
          <section key={category.slug} aria-labelledby={`section-${category.slug}`}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
              <h2 className="flex flex-wrap items-baseline gap-x-4">
                <span
                  id={`section-${category.slug}`}
                  className="display t-h3 font-semibold tracking-wide text-pomegranate uppercase"
                >
                  {category.name}
                </span>
                {SECTION_NOTES[category.name] && (
                  <span className="display text-base italic text-ink/55">
                    {SECTION_NOTES[category.name]}
                  </span>
                )}
              </h2>

              {columnLabels && (
                <div className="hidden shrink-0 gap-2 sm:flex">
                  {columnLabels.map((label, index) => (
                    <p
                      key={label}
                      className="w-32 text-center text-[10px] font-bold leading-4 tracking-[.12em] text-ink/55 uppercase"
                    >
                      {label}
                      <span className="block font-normal tracking-normal">
                        {index === 0 ? "Serves 4–6" : "Serves 10–12"}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <ul className="mt-2">
              {category.products.map((product) => {
                const variants = product.variants.length
                  ? product.variants
                  : [
                      {
                        label: product.soldBy || "Each",
                        price: product.price,
                        soldBy: product.soldBy,
                        unitType: "each" as const,
                        unitLabel: product.soldBy || "Each",
                        minimumQuantity: 1,
                        quantityStep: 1,
                      },
                    ];

                return (
                  <li
                    key={product.id}
                    className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule/60 py-4 last:border-0"
                  >
                    <div className="flex min-w-56 flex-1 gap-3">
                      <Pomegranate />
                      <div>
                        <h3 className="text-sm font-bold tracking-[.06em] text-ink uppercase sm:text-base">
                          {product.title}
                        </h3>
                        {product.description && (
                          <p className="mt-1 max-w-md text-sm leading-6 text-ink/60">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-2">
                      {variants.map((variant) => (
                        <PriceOption
                          key={variant.label}
                          product={product}
                          variant={variant}
                          onAdd={add}
                        />
                      ))}
                      {/* Keeps single-size rows aligned with the two-column ones. */}
                      {columnLabels && variants.length === 1 && <div className="hidden w-32 sm:block" />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
