import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/content/guides";
import { breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Practical guides to ordering and serving Shabbos food — how much to order per person, reheating, and planning a kiddush.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Guides", path: "/guides" },
        ])}
      />

      <section className="border-b border-ink/10 px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Guides</p>
          <h1 className="display mt-6 t-h1 font-semibold">
            What we tell people on the phone.
          </h1>
          <p className="mt-5 leading-8 text-ink/60">
            Quantities, reheating, planning a kiddush — the practical things worth knowing
            before you order, written out properly.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group rounded-[1.75rem] border border-ink/10 bg-white p-7 transition hover:border-ink/25"
            >
              <p className="text-[11px] font-bold tracking-[.18em] text-clay uppercase">
                {guide.readingMinutes} min read
              </p>
              <h2 className="display mt-3 text-3xl font-semibold group-hover:underline decoration-honey decoration-2 underline-offset-4">
                {guide.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink/60">{guide.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
