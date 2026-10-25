import Image from "next/image";
import Link from "next/link";
import type { StorefrontCategory } from "@/lib/storefront/types";

export function CategoryCard({ category, priority = false, basePath = "/shabbos" }: { category: StorefrontCategory; priority?: boolean; basePath?: string }) {
  return (
    <Link href={`${basePath}/${category.slug}`} className="focus-ring group relative min-h-80 overflow-hidden rounded-[2rem] bg-moss text-white">
      <Image src={category.image} alt="" fill priority={priority} className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, 100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-7"><p className="text-[10px] font-bold tracking-[.25em] text-honey uppercase">{category.products.length} choices</p><h3 className="display mt-2 t-h3 font-semibold">{category.name}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-white/75">{category.description}</p></div>
    </Link>
  );
}
