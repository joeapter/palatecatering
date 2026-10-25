import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EVENT_TYPES, TESTIMONIALS } from "@/lib/content/events";
import { breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Event catering & simchas",
  description:
    "Full-service simcha and event catering from Palate in Beit Shemesh — bris, bar and bat mitzvah, Shabbos simcha meals, and corporate programmes, with décor and staffing through Elevate Events.",
  alternates: { canonical: "/catering" },
};

export default function CateringPage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Event catering", path: "/catering" },
        ])}
      />

      <section className="border-b border-ink/10 px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Event catering</p>
          <h1 className="display mt-6 t-h1 font-semibold">
            Your simcha, and none of the work.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/65">
            Under our <b>Elevate Events</b> brand we handle the whole occasion — menus from the
            Palate kitchen, plus décor, florals, lighting, signage, rentals and a team on the
            day. You should be at your own simcha, not running it.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
            What we cater
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EVENT_TYPES.map((event) => (
              <Link
                key={event.slug}
                href={`/catering/${event.slug}`}
                className="group overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white transition hover:border-ink/30"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e4d9]">
                  <Image
                    src={event.image}
                    alt={event.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    sizes="(min-width: 1024px) 33vw, 100vw"
                  />
                </div>
                <div className="p-6">
                  <h3 className="display text-3xl font-semibold">{event.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/60">{event.intro}</p>
                  <p className="mt-4 text-xs font-bold tracking-wider text-clay uppercase">
                    {event.pricing ? "See packages & pricing" : "Quoted per event"} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-ink/10 bg-white px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="display t-h3 font-semibold">
            Everything beyond the food, too.
          </h2>
          <div className="mt-9 grid gap-8 sm:grid-cols-3">
            {[
              {
                name: "Full-service planning",
                detail:
                  "Menus by Palate, complete with rentals, staff and on-site coordination — an elegant, effortless experience.",
              },
              {
                name: "Décor, flowers & balloons",
                detail:
                  "Custom florals, balloon installations and table styling, arranged with an eye for luxury and warmth.",
              },
              {
                name: "Lighting, branding & signage",
                detail:
                  "Custom lighting design, branded signs and immersive atmospheres that bring your vision to life.",
              },
            ].map((item) => (
              <div key={item.name}>
                <h3 className="font-bold">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/60">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">
            What our clients say
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <blockquote
                key={testimonial.attribution}
                className="rounded-[1.5rem] border border-ink/10 bg-white p-6"
              >
                <p className="leading-7 text-ink/75">&ldquo;{testimonial.quote}&rdquo;</p>
                <footer className="mt-4 text-xs font-semibold text-ink/50">
                  — {testimonial.attribution}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-[2rem] bg-moss p-10 text-white sm:p-14">
          <h2 className="display t-h3 font-semibold">Let&rsquo;s plan it.</h2>
          <p className="mt-4 max-w-xl leading-7 text-white/75">
            Tell us the date, the venue and roughly how many people. We will come back with
            sample menus and an honest price.
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
            <a href="tel:+972587280062" className="rounded-full border border-white/30 px-7 py-4 text-sm font-bold">
              058-728-0062
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
