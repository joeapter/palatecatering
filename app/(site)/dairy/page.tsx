import type { Metadata } from "next";
import { OrderContextBanner } from "@/components/order-context-banner";
import { ProductCard } from "@/components/product-card";
import { getDairyCatalog } from "@/lib/storefront/catalog";

export const metadata: Metadata = {
  title: "Dairy Menu",
  description: "Browse Palate’s Mehadrin dairy menu: platters, pasta, salads, breakfast, fish, desserts and more.",
  alternates: { canonical: "/dairy" },
};
export const revalidate = 300;

export default async function DairyPage() {
  const catalog = await getDairyCatalog();
  return (
    <main>
      <OrderContextBanner />
      <section className="bg-moss px-6 py-14 text-white sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-[.28em] text-honey uppercase">Dairy menu</p>
          <h1 className="display mt-4 t-h1 font-semibold">Fresh, generous, ready to serve.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/70">
            Breakfasts, platters, pastas, salads and desserts for everyday orders, meetings and simchas.
          </p>
        </div>
      </section>
      <div className="px-5 py-10 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-7xl space-y-14 sm:space-y-20">
          {catalog.map((category) => (
            <section key={category.slug} id={category.slug} className="scroll-mt-24">
              <div className="mb-6 border-b border-ink/10 pb-5 sm:mb-8">
                <h2 className="display t-h2 font-semibold">{category.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60 sm:text-base">{category.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                {category.products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
