import type { Metadata } from "next";
import { getHolidayMenu } from "@/lib/storefront/holiday";
import { HolidayMenu } from "@/components/holiday-menu";
import { OrderContextBanner } from "@/components/order-context-banner";
import { breadcrumbs, categoryItemList } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sukkos holiday takeout menu",
  description:
    "Palate's Sukkos holiday takeout menu — salatim, soups, salmon, brisket, capons, sides and kugels, cooked for the succah. Mehadrin, cooked in Ramat Beit Shemesh.",
  // Evergreen URL, kept year to year so links and search equity accumulate.
  alternates: { canonical: "/holidays/sukkos" },
};

export default async function SukkosPage() {
  const categories = await getHolidayMenu("sukkos");
  const allProducts = categories.flatMap((category) => category.products);

  return (
    <main className="bg-parchment">
      <OrderContextBanner />
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Holidays", path: "/holidays" },
          { name: "Sukkos", path: "/holidays/sukkos" },
        ])}
      />
      {allProducts.length > 0 && (
        <JsonLd
          data={categoryItemList({
            name: "Sukkos holiday takeout menu",
            slug: "sukkos",
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
          Sukkos
        </h1>
        <div className="mx-auto mt-6 flex max-w-md items-center gap-4">
          <span className="h-px flex-1 bg-rule" />
          {/* Lulav and esrog, drawn plainly so it reads at 16px the way the
              pomegranate does on the Rosh Hashanah sheet. */}
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-pomegranate">
            <path d="M13.2 22V9.6c0-2.6 1-5 2.9-6.9.5-.5 1.3 0 1.1.7-.6 2-.8 3.6-.7 5 .9-1 2-1.8 3.3-2.4.6-.3 1.2.4.8.9-1.9 2.4-3.1 4.6-3.7 6.6-.4 1.3-1.6 2.2-3 2.2h-.7V22h-1.9z" />
            <path d="M7.4 13.1c2 0 3.6 1.7 3.6 3.8s-1.6 3.8-3.6 3.8-3.6-1.7-3.6-3.8 1.6-3.8 3.6-3.8z" />
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
              The Sukkos menu is being finalised. Call{" "}
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
