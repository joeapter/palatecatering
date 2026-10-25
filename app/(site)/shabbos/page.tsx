import type { Metadata } from "next";
import { CategoryCard } from "@/components/category-card";
import { CategoryStrip } from "@/components/category-strip";
import { getShabbosCatalog } from "@/lib/storefront/catalog";
import { OrderContextBanner } from "@/components/order-context-banner";

export const metadata: Metadata = { title: "Shabbos Menu", description: "Browse Palate’s kosher Shabbos menu by category." };
export const revalidate = 300;

export default async function ShabbosPage() {
  const catalog = await getShabbosCatalog();
  return <main><OrderContextBanner /><section className="bg-moss px-6 py-14 sm:py-20 text-white lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold tracking-[.28em] text-honey uppercase">Weekly menu</p><h1 className="display mt-4 t-h1 font-semibold">Shabbos, sorted.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-white/70">Move through the menu one course at a time. Your order window, pickup or delivery choice, and cart will stay with you throughout the new storefront.</p></div></section><CategoryStrip categories={catalog} /><section className="px-6 py-14 sm:py-20 lg:px-10"><div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">{catalog.map((category, index) => <CategoryCard key={category.slug} category={category} priority={index < 3} />)}</div></section></main>;
}
