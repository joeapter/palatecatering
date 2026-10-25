import type { Metadata } from "next";
import Link from "next/link";
import { getBundles } from "@/lib/storefront/bundles";
import { BundleCard } from "@/components/bundle-card";
import { notFound } from "next/navigation";
import { OrderContextBanner } from "@/components/order-context-banner";
import { getFeatureFlags } from "@/lib/site-settings";

// Dynamic so switching packages off in the admin takes effect immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete Shabbos Packages",
  description:
    "Curated Shabbos packages from Palate — salatim, soup, fish, kugel and mains chosen together and priced as one, delivered across Beit Shemesh and Jerusalem.",
};

export default async function PackagesPage() {
  // Packages can be switched off entirely from the admin. When they are off the
  // page 404s rather than showing an empty shop, so nothing links into a dead end.
  const { packagesEnabled } = await getFeatureFlags();
  if (!packagesEnabled) notFound();

  const bundles = await getBundles();

  return (
    <main>
      <OrderContextBanner />

      <section className="border-b border-ink/10 px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Packages</p>
          <h1 className="display mt-6 t-h1 font-semibold">
            The whole table, decided.
          </h1>
          <p className="mt-5 max-w-xl leading-8 text-ink/60">
            Full Shabbos menus put together the way we would cook them at home — so you
            can order once instead of choosing thirty dishes.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-7xl">
          {bundles.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-ink/20 bg-white/60 p-12 text-center">
              <h2 className="display text-3xl font-semibold">Packages are being finalised.</h2>
              <p className="mx-auto mt-4 max-w-lg leading-7 text-ink/60">
                Our Shabbos packages are having their pricing confirmed. In the meantime the
                full menu is open and you can build your order dish by dish.
              </p>
              <Link
                href="/shabbos"
                className="mt-7 inline-block rounded-full bg-ink px-7 py-4 text-sm font-bold text-white"
              >
                Browse the Shabbos menu
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {bundles.map((bundle) => (
                <BundleCard
                  key={bundle.id}
                  bundle={{
                    id: bundle.id,
                    name: bundle.name,
                    slug: bundle.slug,
                    image: bundle.image,
                    price: bundle.price,
                    serves: bundle.serves,
                    description: bundle.description,
                  }}
                  itemCount={bundle.items.length}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
