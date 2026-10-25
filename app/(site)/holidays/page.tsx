import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Yom Tov menus",
  description:
    "Mehadrin Yom Tov catering from Palate in Beit Shemesh — Rosh Hashanah, Sukkos, Chanukah, Purim, Pesach and Shavuos.",
  alternates: { canonical: "/holidays" },
};

/**
 * Evergreen URLs, deliberately without a year: the same page is updated each
 * cycle so links and search equity accumulate instead of resetting annually.
 */
const HOLIDAYS = [
  {
    slug: "sukkos",
    name: "Sukkos",
    when: "September–October",
    blurb: "Salatim, soup, salmon, brisket and kugels for the succah — yom tov and chol hamoed.",
    live: true,
  },
  { slug: "rosh-hashanah", name: "Rosh Hashanah", when: "September", blurb: "Simanim, round challah, fish, soup and brisket. Ordering opens again next Elul.", live: false },
  { slug: "chanukah", name: "Chanukah", when: "December", blurb: "Parties, latkes and platters for the eight nights.", live: false },
  { slug: "purim", name: "Purim", when: "March", blurb: "Seudah spreads and mishloach manos platters.", live: false },
  { slug: "pesach", name: "Pesach", when: "April", blurb: "Kosher for Pesach cooking, seder to last days.", live: false },
  { slug: "shavuos", name: "Shavuos", when: "May–June", blurb: "The dairy menu — lasagna, quiches, cheesecake.", live: false },
];

export default function HolidaysPage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Holidays", path: "/holidays" },
        ])}
      />

      <section className="border-b border-ink/10 px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Seasonal menus</p>
          <h1 className="display mt-6 t-h1 font-semibold">Yom Tov at Palate.</h1>
          <p className="mt-5 max-w-2xl leading-8 text-ink/60">
            Every yom tov has its own menu and its own ordering deadline. Menus open six to
            eight weeks ahead.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          {HOLIDAYS.map((holiday) =>
            holiday.live ? (
              <Link
                key={holiday.slug}
                href={`/holidays/${holiday.slug}`}
                className="group rounded-[1.75rem] border-2 border-honey bg-white p-7 transition hover:border-ink/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold tracking-[.18em] text-clay uppercase">
                    {holiday.when}
                  </p>
                  <span className="rounded-full bg-honey px-3 py-1 text-[10px] font-bold uppercase">
                    Orders open
                  </span>
                </div>
                <h2 className="display mt-3 t-h3 font-semibold group-hover:underline decoration-honey decoration-2 underline-offset-4">
                  {holiday.name}
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">{holiday.blurb}</p>
              </Link>
            ) : (
              <div key={holiday.slug} className="rounded-[1.75rem] border border-ink/10 bg-white/60 p-7">
                <p className="text-[11px] font-bold tracking-[.18em] text-ink/40 uppercase">
                  {holiday.when}
                </p>
                <h2 className="display mt-3 t-h3 font-semibold text-ink/45">{holiday.name}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/45">{holiday.blurb}</p>
                <p className="mt-4 text-xs text-ink/40">Menu opens closer to the time.</p>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
