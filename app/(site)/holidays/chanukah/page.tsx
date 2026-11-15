import type { Metadata } from "next";
import { getHolidayMenu } from "@/lib/storefront/holiday";
import { HolidayMenu } from "@/components/holiday-menu";
import { OrderContextBanner } from "@/components/order-context-banner";
import { breadcrumbs, categoryItemList } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Chanukah holiday takeout menu",
  description:
    "Palate's Chanukah takeout menu — potato and sweet potato latkes, the Ultimate Latke Platter, beef empanadas, egg rolls and salads. Mehadrin, cooked in Ramat Beit Shemesh.",
  // Evergreen URL, kept year to year so links and search equity accumulate.
  alternates: { canonical: "/holidays/chanukah" },
};

/** Sections in the order they appear on the printed menu. */
const SECTION_ORDER = ["Latkes", "Savory Specialties", "Salads"];

function sectionRank(name: string) {
  const index = SECTION_ORDER.indexOf(name);
  return index === -1 ? SECTION_ORDER.length : index;
}

export default async function ChanukahPage() {
  const categories = (await getHolidayMenu("chanukah")).sort(
    (a, b) => sectionRank(a.name) - sectionRank(b.name),
  );
  const allProducts = categories.flatMap((category) => category.products);

  return (
    <main className="bg-parchment">
      <OrderContextBanner />
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Holidays", path: "/holidays" },
          { name: "Chanukah", path: "/holidays/chanukah" },
        ])}
      />
      {allProducts.length > 0 && (
        <JsonLd
          data={categoryItemList({
            name: "Chanukah holiday takeout menu",
            slug: "chanukah",
            products: allProducts,
          })}
        />
      )}

      {/* Masthead, following the printed menu. */}
      <section className="px-6 pt-16 pb-10 text-center lg:px-10">
        <p className="text-[11px] font-bold tracking-[.4em] text-ink/70 uppercase">
          Palate — Catering &amp; Events —
        </p>
        <h1 className="mt-6 display t-h1 font-semibold tracking-wide text-pomegranate uppercase">
          Chanukah
        </h1>
        <div className="mx-auto mt-6 flex max-w-md items-center gap-4">
          <span className="h-px flex-1 bg-rule" />
          {/* A menorah, drawn plainly so it reads at 16px. */}
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-pomegranate">
            <path d="M11.2 1.5c.5.9.8 1.5.8 2.1a.8.8 0 0 1-1.6 0c0-.6.3-1.2.8-2.1zM12.8 1.5c-.5.9-.8 1.5-.8 2.1a.8.8 0 0 0 1.6 0c0-.6-.3-1.2-.8-2.1z" />
            <path d="M11.2 5h1.6v13h-1.6zM2 7h1.4v4.5a8.6 8.6 0 0 0 8.6 6.5v1.4a10 10 0 0 1-10-7.9zM22 7h-1.4v4.5a8.6 8.6 0 0 1-8.6 6.5v1.4a10 10 0 0 0 10-7.9zM5.5 7h1.4v4.2a5 5 0 0 0 5.1 3.8v1.4A6.4 6.4 0 0 1 5.5 11.2zM18.5 7h-1.4v4.2a5 5 0 0 1-5.1 3.8v1.4a6.4 6.4 0 0 0 6.5-5.2zM8.8 7h1.4v3.2a1.8 1.8 0 0 0 1.8 1.6v1.4a3.2 3.2 0 0 1-3.2-3z M15.2 7h-1.4v3.2a1.8 1.8 0 0 1-1.8 1.6v1.4a3.2 3.2 0 0 0 3.2-3z" />
            <path d="M7.5 20.5h9V22h-9z" />
          </svg>
          <span className="h-px flex-1 bg-rule" />
        </div>
        <p className="mt-5 text-[11px] font-bold tracking-[.4em] text-ink/70 uppercase">
          Holiday takeout menu
        </p>
      </section>

      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto max-w-4xl">
          {categories.length === 0 ? (
            <p className="text-center leading-7 text-ink/60">
              The Chanukah menu is being finalised. Call{" "}
              <a href="tel:+972587280062" className="underline">058-728-0062</a> and we will
              take your order directly.
            </p>
          ) : (
            <HolidayMenu categories={categories} />
          )}
        </div>
      </section>

      {/* Order strip, as on the printed menu. */}
      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4 rounded-lg border border-pomegranate/35 px-8 py-7 text-center">
          <p className="display text-3xl font-semibold tracking-wide text-pomegranate uppercase">
            Order today!
          </p>
          <a href="tel:+972587280062" className="focus-ring text-sm font-semibold text-ink">
            058.728.0062
          </a>
          <a
            href="https://wa.me/972587280062"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-sm font-semibold text-ink"
          >
            WhatsApp
          </a>
          <a
            href="https://instagram.com/palate.catering"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-sm font-semibold text-ink"
          >
            @palate.catering
          </a>
        </div>

        <p className="mx-auto mt-8 max-w-md text-center text-xs leading-6 text-ink/55">
          כשר למהדרין באישור הרב דוד משה הלוי לוין
          <span className="mt-1 block">מוסדות אהבת יהונתן, רמת בית שמש</span>
        </p>
      </section>
    </main>
  );
}
