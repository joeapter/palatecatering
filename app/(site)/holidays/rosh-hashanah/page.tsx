import type { Metadata } from "next";
import Link from "next/link";
import { breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rosh Hashanah holiday takeout menu",
  description:
    "Palate's Rosh Hashanah holiday takeout menu — salatim, soups, salmon, brisket, chicken, sides and kugels. Mehadrin, cooked in Ramat Beit Shemesh. Ordering opens again next Elul.",
  // Evergreen URL, kept year to year so links and search equity accumulate.
  alternates: { canonical: "/holidays/rosh-hashanah" },
};

/**
 * Rosh Hashanah, between years.
 *
 * The menu itself is still in the database, untouched, ready to be switched
 * back on next Elul — the page stops serving it rather than the dishes being
 * deleted. Anyone arriving on the link now is sent to the menu that is open,
 * which beats an empty page or a 404 on a URL that has years of search behind
 * it.
 */

export default function RoshHashanahPage() {
  return (
    <main className="bg-parchment">
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Holidays", path: "/holidays" },
          { name: "Rosh Hashanah", path: "/holidays/rosh-hashanah" },
        ])}
      />

      <section className="px-6 pt-16 pb-10 text-center lg:px-10">
        <p className="text-[11px] font-bold tracking-[.4em] text-ink/70 uppercase">
          Palate — Catering &amp; Events —
        </p>
        <h1 className="mt-6 display t-h1 font-semibold tracking-wide text-pomegranate uppercase">
          Rosh Hashanah
        </h1>
        <div className="mx-auto mt-6 flex max-w-md items-center gap-4">
          <span className="h-px flex-1 bg-rule" />
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-pomegranate">
            <path d="M12 3c.5-1.2 1.6-2 2.7-2.2-.2 1.2-.8 2.1-1.7 2.6 4 .6 7 3.9 7 8 0 5-3.6 9.6-8 9.6S4 16.4 4 11.4c0-4.1 3-7.4 7-8 .3 0 .7 0 1-.4z" />
          </svg>
          <span className="h-px flex-1 bg-rule" />
        </div>
      </section>

      <section className="px-6 pb-24 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="leading-8 text-ink/70">
            Rosh Hashanah ordering has closed for this year. The kitchen is on Sukkos now —
            the same salatim, soups, salmon, brisket and kugels, cooked for the succah.
          </p>
          <Link
            href="/holidays/sukkos"
            className="focus-ring mt-8 inline-block rounded-full bg-ink px-7 py-4 text-sm font-bold text-white"
          >
            See the Sukkos menu
          </Link>
          <p className="mt-8 text-sm leading-7 text-ink/55">
            Cooking for a simcha, or want next year&rsquo;s menu held for you? Call{" "}
            <a href="tel:+972587280062" className="underline">058-728-0062</a> or{" "}
            <a href="https://wa.me/972587280062" target="_blank" rel="noopener noreferrer" className="underline">
              message us on WhatsApp
            </a>.
          </p>
        </div>

        <p className="mx-auto mt-14 max-w-md text-center text-xs leading-6 text-ink/55">
          כשר למהדרין באישור הרב דוד משה הלוי לוין
          <span className="mt-1 block">מוסדות אהבת יהונתן, רמת בית שמש</span>
        </p>
      </section>
    </main>
  );
}
