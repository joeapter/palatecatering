import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { CategoryStrip } from "@/components/category-strip";
import { getCategory, getShabbosCatalog } from "@/lib/storefront/catalog";
import { OrderContextBanner } from "@/components/order-context-banner";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbs, categoryItemList } from "@/lib/seo/structured-data";

export const revalidate = 300;
export async function generateStaticParams() { return (await getShabbosCatalog()).map((category) => ({ category: category.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  const description =
    category.description ||
    `${category.name} for Shabbos from Palate — Mehadrin, cooked in Beit Shemesh and delivered across the area.`;
  return {
    title: `${category.name} for Shabbos`,
    description,
    alternates: { canonical: `/shabbos/${category.slug}` },
    openGraph: { title: `${category.name} for Shabbos`, description, images: [category.image] },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params; const catalog = await getShabbosCatalog(); const category = catalog.find((item) => item.slug === slug); if (!category) notFound();
  return <main><JsonLd data={categoryItemList({ name: category.name, slug: category.slug, products: category.products })} /><JsonLd data={breadcrumbs([{ name: "Palate", path: "/" }, { name: "Shabbos", path: "/shabbos" }, { name: category.name, path: `/shabbos/${category.slug}` }])} /><OrderContextBanner /><section className="border-b border-ink/10 px-5 py-7 sm:py-14 lg:px-10"><div className="mx-auto max-w-7xl"><nav className="text-xs font-semibold text-ink/50"><Link href="/shabbos">Shabbos</Link><span className="mx-2">/</span><span>{category.name}</span></nav><h1 className="display mt-3 t-h1 font-semibold sm:mt-7">{category.name}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink/60 sm:text-base sm:leading-7">{category.description}</p></div></section><CategoryStrip categories={catalog} active={slug} /><section className="px-5 py-8 sm:py-16 lg:px-10"><div className="mx-auto grid max-w-7xl gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{category.products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section></main>;
}
