import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@vercel/postgres";
import { DELIVERY_AREAS } from "@/lib/content/delivery-areas";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbs } from "@/lib/seo/structured-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Delivery areas — Beit Shemesh, Jerusalem & Modiin",
  description:
    "Palate delivers Shabbos and Yom Tov food across Beit Shemesh and Ramat Beit Shemesh, all of Jerusalem including Efrat, Gush Etzion, Maale Adumim and Mevaseret, and the Modiin area. See the delivery fee for your neighbourhood.",
  alternates: { canonical: "/delivery" },
};

type Zone = { slug: string; name: string; fee: string; free_delivery_threshold: string | null };

/**
 * Where we deliver.
 *
 * Written to answer a question in the exact words people ask it — "do you
 * deliver to Old Katamon" — because a page that only says "Jerusalem and
 * surrounding areas" cannot be quoted as an answer by anyone, human or machine.
 *
 * Fees are read from the same table the checkout prices against, so a price
 * change in the admin cannot leave this page quietly lying.
 */
export default async function DeliveryPage() {
  let zones: Zone[] = [];
  try {
    const { rows } = await sql`
      SELECT slug, name, fee, free_delivery_threshold
      FROM delivery_zones WHERE active = true;
    `;
    zones = rows as Zone[];
  } catch {
    // The named areas are still worth showing without live prices.
    zones = [];
  }

  const zoneFor = (slug: string) => zones.find((zone) => zone.slug === slug);
  const money = (value: string | null | undefined) =>
    value == null ? null : `₪${Number(value).toFixed(0)}`;

  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "Palate", path: "/" }, { name: "Delivery areas", path: "/delivery" }])} />
      {/* States the service area as machine-readable fact, so an assistant
          asked "does Palate deliver to Efrat" has something unambiguous to
          read rather than inferring it from prose. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FoodEstablishment",
          name: "Palate Catering",
          url: "https://www.palatecateringisrael.com",
          telephone: "+972-58-728-0062",
          servesCuisine: "Kosher",
          address: { "@type": "PostalAddress", addressLocality: "Beit Shemesh", addressCountry: "IL" },
          areaServed: DELIVERY_AREAS.flatMap((group) =>
            group.areas.map((area) => ({ "@type": "Place", name: area.split(" — ")[0] })),
          ),
        }}
      />

      <section className="border-b border-ink/10 px-5 py-10 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <nav className="text-xs font-semibold text-ink/50">
            <Link href="/">Palate</Link><span className="mx-2">/</span><span>Delivery areas</span>
          </nav>
          <h1 className="display t-h1 mt-3 font-semibold sm:mt-6">Where we deliver</h1>
          <p className="mt-4 max-w-2xl leading-7 text-ink/65">
            We cook in Beit Shemesh and deliver before Shabbos and Yom Tov across Beit Shemesh,
            Jerusalem and the Modiin area. Pickup from the kitchen is always available. Choose
            your area at checkout and the fee is added automatically — there is nothing to work out.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {DELIVERY_AREAS.map((group) => {
            const zone = zoneFor(group.slug);
            const fee = money(zone?.fee);
            const free = money(zone?.free_delivery_threshold ?? null);
            return (
              <article key={group.slug} className="rounded-[1.75rem] border border-ink/10 bg-white p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="display t-h3 font-semibold">{group.title}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-ink/65">{group.blurb}</p>
                  </div>
                  {fee && (
                    <div className="shrink-0 rounded-2xl bg-cream px-5 py-3 text-right">
                      <p className="text-2xl font-bold tabular-nums">{fee}</p>
                      {free && <p className="mt-0.5 text-xs text-ink/60">Free over {free}</p>}
                    </div>
                  )}
                </div>

                <ul className="mt-6 flex flex-wrap gap-2">
                  {group.areas.map((area) => (
                    <li key={area} className="rounded-full border border-ink/15 bg-cream/60 px-3 py-1.5 text-sm">
                      {area}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}

          <div className="rounded-[1.75rem] bg-moss p-6 text-white sm:p-8">
            <h2 className="display t-h3 font-semibold">Don&rsquo;t see your area?</h2>
            <p className="mt-3 max-w-xl leading-7 text-white/75">
              We often deliver further, especially for a simcha or a larger order. Send us a
              message with where you are and what you need, and we will tell you straight away
              whether we can get to you and what it costs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://wa.me/972587280062" className="focus-ring rounded-full bg-cream px-6 py-3.5 text-sm font-bold text-ink">
                Ask on WhatsApp
              </a>
              <a href="tel:+972587280062" className="focus-ring rounded-full border border-white/40 px-6 py-3.5 text-sm font-bold">
                058-728-0062
              </a>
            </div>
          </div>

          <p className="text-center">
            <Link href="/shabbos" className="focus-ring inline-block rounded-full bg-ink px-7 py-4 text-sm font-bold text-white">
              See this week&rsquo;s menu
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
