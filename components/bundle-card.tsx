"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useStorefront, type CartBundle } from "./storefront-provider";

/**
 * A package is one cart line at one price, so unlike a product it has no
 * variant picker. The saving shown is the difference against the same contents
 * bought separately, computed on the server from live product prices.
 */
export function BundleCard({
  bundle,
  itemCount,
}: {
  bundle: CartBundle & { description?: string };
  itemCount: number;
}) {
  const { addBundle } = useStorefront();
  const [adding, setAdding] = useState(false);

  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white">
      <Link href={`/packages/${bundle.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#e9e4d9]">
        {bundle.image ? (
          <Image
            src={bundle.image}
            alt={bundle.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        ) : (
          <div className="paper-grain flex h-full items-center justify-center text-xs tracking-[.2em] text-ink/45 uppercase">
            Palate
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-honey px-3 py-2 text-[10px] font-bold tracking-wider text-ink uppercase">
          Package
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <p className="text-[11px] font-bold tracking-[.18em] text-clay uppercase">{bundle.serves}</p>
        <h3 className="display mt-2 text-3xl font-semibold">
          <Link href={`/packages/${bundle.slug}`}>{bundle.name}</Link>
        </h3>
        {bundle.description && (
          <p className="mt-3 text-sm leading-6 text-ink/60">{bundle.description}</p>
        )}
        <p className="mt-3 text-xs text-ink/50">
          {itemCount} {itemCount === 1 ? "dish" : "dishes"} included
        </p>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div>
            <p className="text-2xl font-bold">₪{bundle.price.toFixed(0)}</p>
            <p className="text-xs text-ink/45">Package rate</p>
          </div>
          <button
            type="button"
            onClick={() => {
              addBundle(bundle, 1);
              setAdding(true);
              setTimeout(() => setAdding(false), 1200);
            }}
            className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-moss"
          >
            {adding ? "Added" : "Add package"}
          </button>
        </div>
      </div>
    </article>
  );
}
