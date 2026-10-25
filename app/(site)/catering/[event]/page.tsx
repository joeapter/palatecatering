import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT_TYPES, getEventType } from "@/lib/content/events";
import { breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 86400;

export async function generateStaticParams() {
  return EVENT_TYPES.map((event) => ({ event: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ event: string }>;
}): Promise<Metadata> {
  const { event: slug } = await params;
  const event = getEventType(slug);
  if (!event) return {};
  return {
    title: `${event.name} catering`,
    description: event.metaDescription,
    alternates: { canonical: `/catering/${event.slug}` },
    openGraph: { title: `${event.name} catering`, description: event.metaDescription, images: [event.image] },
  };
}

export default async function EventPage({ params }: { params: Promise<{ event: string }> }) {
  const { event: slug } = await params;
  const event = getEventType(slug);
  if (!event) notFound();

  return (
    <main>
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Event catering", path: "/catering" },
          { name: event.name, path: `/catering/${event.slug}` },
        ])}
      />

      <section className="px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_.85fr] lg:items-center">
          <div>
            <nav className="text-xs font-semibold text-ink/50">
              <Link href="/catering">Event catering</Link>
              <span className="mx-2">/</span>
              <span>{event.name}</span>
            </nav>
            <p className="mt-6 text-xs font-bold tracking-[.25em] text-clay uppercase">
              {event.eyebrow}
            </p>
            <h1 className="display mt-4 t-h1 font-semibold">{event.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/65">{event.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://wa.me/972587280062"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-ink px-7 py-4 text-sm font-bold text-white"
              >
                Check availability
              </a>
              <a href="tel:+972587280062" className="rounded-full border border-ink/20 px-7 py-4 text-sm font-bold">
                058-728-0062
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[#e9e4d9]">
            <Image
              src={event.image}
              alt={event.name}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 45vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>

      {(event.included || event.menuHighlights || event.pricing) && (
        <section className="border-y border-ink/10 bg-white px-6 py-16 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-3">
            {event.included && (
              <div>
                <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
                  What&rsquo;s included
                </h2>
                <ul className="mt-5 space-y-3">
                  {event.included.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-ink/70">
                      <span aria-hidden className="text-honey">✦</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {event.menuHighlights && (
              <div>
                <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
                  Menu highlights
                </h2>
                <ul className="mt-5 space-y-3">
                  {event.menuHighlights.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-ink/70">
                      <span aria-hidden className="text-honey">✦</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {event.pricing && (
              <div className="rounded-[1.5rem] border-2 border-honey p-6">
                <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">Pricing</h2>
                <dl className="mt-5 space-y-3">
                  {event.pricing.tiers.map((tier) => (
                    <div key={tier.label} className="border-b border-ink/10 pb-3 last:border-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-sm">{tier.label}</dt>
                        <dd className="shrink-0 font-bold tabular-nums">{tier.price}</dd>
                      </div>
                      {tier.note && <p className="mt-1 text-xs leading-5 text-ink/55">{tier.note}</p>}
                    </div>
                  ))}
                </dl>
                {event.pricing.minimum && (
                  <p className="mt-4 text-sm font-semibold">{event.pricing.minimum}</p>
                )}
                {event.pricing.note && (
                  <p className="mt-2 text-xs leading-5 text-ink/55">{event.pricing.note}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {event.highlights && (
        <section className="px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="display t-h3 font-semibold">
              {event.enquiryOnly ? "How we help" : "Make it feel like your family"}
            </h2>
            <div className="mt-9 grid gap-8 sm:grid-cols-3">
              {event.highlights.map((item) => (
                <div key={item.name}>
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {event.addOns && (
        <section className="border-t border-ink/10 px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="display t-h3 font-semibold">Add-ons & live stations</h2>
            <p className="mt-4 max-w-2xl leading-7 text-ink/60">
              Mix and match stations, salads and sweets on top of the base package. Tell us
              your guest count and we will suggest quantities.
            </p>
            <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {event.addOns.map((group) => (
                <div key={group.group}>
                  <h3 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
                    {group.group}
                  </h3>
                  <ul className="mt-4 space-y-4">
                    {group.items.map((item) => (
                      <li key={item.name} className="border-b border-ink/10 pb-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <b className="text-sm font-semibold">{item.name}</b>
                          <span className="shrink-0 text-sm tabular-nums text-ink/60">
                            {item.price}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink/55">{item.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {event.process && (
        <section className="border-t border-ink/10 bg-white px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="display t-h3 font-semibold">Here&rsquo;s how we work</h2>
            <ol className="mt-9 grid gap-8 sm:grid-cols-3">
              {event.process.map((item, index) => (
                <li key={item.step}>
                  <p className="text-3xl font-bold text-honey tabular-nums">{index + 1}</p>
                  <h3 className="mt-2 font-bold">{item.step}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{item.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-[2rem] bg-moss p-10 text-white sm:p-14">
          <h2 className="display t-h3 font-semibold">
            {event.enquiryOnly ? "Tell us about your simcha." : "Check your date."}
          </h2>
          <p className="mt-4 max-w-xl leading-7 text-white/75">
            Send us the date, the venue and roughly how many people, and we will come back
            with sample menus and a real price.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://wa.me/972587280062"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-honey px-7 py-4 text-sm font-bold text-ink"
            >
              WhatsApp us
            </a>
            <Link href="/catering" className="rounded-full border border-white/30 px-7 py-4 text-sm font-bold">
              Other events
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
