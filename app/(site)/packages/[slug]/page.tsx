import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeatureFlags } from "@/lib/site-settings";
import { getBundle } from "@/lib/storefront/bundles";
import { BundleAddButton } from "@/components/bundle-add-button";
import { OrderContextBanner } from "@/components/order-context-banner";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbs, productOffer } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundle(slug);
  if (!bundle) return {};
  return {
    title: `${bundle.name} · ${bundle.serves}`,
    description: bundle.description,
    alternates: { canonical: `/packages/${bundle.slug}` },
    openGraph: { title: bundle.name, description: bundle.description, images: [bundle.image] },
  };
}

export default async function BundlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { packagesEnabled } = await getFeatureFlags();
  if (!packagesEnabled) notFound();
  const bundle = await getBundle(slug);
  if (!bundle) notFound();

  return (
    <main>
      <JsonLd
        data={productOffer({
          name: bundle.name,
          description: bundle.description,
          image: bundle.image,
          price: bundle.price,
          path: `/packages/${bundle.slug}`,
        })}
      />
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Packages", path: "/packages" },
          { name: bundle.name, path: `/packages/${bundle.slug}` },
        ])}
      />
      <OrderContextBanner />

      <section className="px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#e9e4d9]">
            {bundle.image && (
              <Image
                src={bundle.image}
                alt={bundle.name}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
              />
            )}
          </div>

          <div>
            <nav className="text-xs font-semibold text-ink/50">
              <Link href="/packages">Packages</Link>
              <span className="mx-2">/</span>
              <span>{bundle.name}</span>
            </nav>

            <p className="mt-6 text-[11px] font-bold tracking-[.18em] text-clay uppercase">
              {bundle.serves}
            </p>
            <h1 className="display mt-2 t-h2 font-semibold">{bundle.name}</h1>
            <p className="mt-5 leading-7 text-ink/65">{bundle.description}</p>

            <div className="mt-8 flex items-end gap-4">
              <p className="text-4xl font-bold">₪{bundle.price.toFixed(0)}</p>
              <p className="pb-1 text-sm text-ink/50">
                Package rate · {bundle.items.length} dishes
              </p>
            </div>

            <BundleAddButton
              bundle={{
                id: bundle.id,
                name: bundle.name,
                slug: bundle.slug,
                image: bundle.image,
                price: bundle.price,
                serves: bundle.serves,
              }}
            />

            <div className="mt-10 border-t border-ink/10 pt-8">
              <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
                What&rsquo;s included
              </h2>
              <ul className="mt-5 space-y-3">
                {bundle.items.map((item, index) => (
                  <li
                    key={`${item.productId}-${index}`}
                    className="flex items-baseline justify-between gap-4 border-b border-ink/5 pb-3 text-sm"
                  >
                    <span>
                      <b className="font-semibold">{item.title}</b>
                      {item.variantLabel && (
                        <span className="text-ink/50"> · {item.variantLabel}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-ink/45">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
