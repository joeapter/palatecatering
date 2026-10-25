import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, FAQ_GROUPS } from "@/lib/content/faq";
import { faqPage, breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Questions & answers",
  description:
    "Cutoffs, delivery areas and fees, kashrus, portion sizes, reheating and payment — the questions we are asked most about Palate's kosher Shabbos food in Beit Shemesh.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <main>
      <JsonLd data={faqPage(FAQ.map(({ question, answer }) => ({ question, answer })))} />
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Questions & answers", path: "/faq" },
        ])}
      />

      <section className="border-b border-ink/10 px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Questions</p>
          <h1 className="display mt-6 t-h1 font-semibold">
            The things people ask us.
          </h1>
          <p className="mt-5 leading-8 text-ink/60">
            If your question is not here, call or WhatsApp{" "}
            <a href="tel:+972587280062" className="underline decoration-honey decoration-2 underline-offset-4">
              058-728-0062
            </a>{" "}
            — a person will answer.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-3xl">
          {FAQ_GROUPS.map((group) => (
            <div key={group} className="mb-14 last:mb-0">
              <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">{group}</h2>
              <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {FAQ.filter((entry) => entry.group === group).map((entry) => (
                  <div key={entry.question} className="py-6">
                    <dt className="text-lg font-semibold">{entry.question}</dt>
                    <dd className="mt-3 leading-7 text-ink/65">{entry.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <div className="mt-16 rounded-[1.75rem] bg-moss p-8 text-white sm:p-10">
            <h2 className="display t-h3 font-semibold">Still deciding?</h2>
            <p className="mt-4 leading-7 text-white/75">
              The full Shabbos menu is open, and packages take the deciding out of it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/shabbos" className="rounded-full bg-honey px-6 py-4 text-sm font-bold text-ink">
                Browse the menu
              </Link>
              <Link href="/packages" className="rounded-full border border-white/30 px-6 py-4 text-sm font-bold">
                See packages
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
