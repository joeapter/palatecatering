import Image from "next/image";
import Link from "next/link";
import type { StorefrontCategory } from "@/lib/storefront/types";

export function CategoryStrip({ categories, active, basePath = "/shabbos", label = "Shabbos categories" }: { categories: StorefrontCategory[]; active?: string; basePath?: string; label?: string }) {
  // `rail` hides the scrollbar and snaps each tile, so this swipes like a
  // native carousel instead of looking like a stray horizontal scrollbar.
  return <nav aria-label={label} className="border-b border-ink/10 bg-cream py-5 sm:py-7"><div className="rail mx-auto flex max-w-7xl gap-3 overflow-x-auto px-5 pb-2">{categories.map((category) => <Link key={category.slug} href={`${basePath}/${category.slug}`} aria-current={active === category.slug ? "page" : undefined} className={`focus-ring group relative h-36 min-w-32 overflow-hidden rounded-2xl border-2 sm:h-40 sm:min-w-40 ${active === category.slug ? "border-clay" : "border-transparent"}`}><Image src={category.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" sizes="160px" /><span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/5 to-transparent" /><span className="absolute inset-x-0 bottom-0 p-3 text-center text-xs font-extrabold tracking-wide text-white uppercase">{category.name}</span></Link>)}</div></nav>;
}
