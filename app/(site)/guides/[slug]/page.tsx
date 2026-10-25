import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/lib/content/guides";
import { article, breadcrumbs } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 86400;

export async function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, type: "article" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <main>
      <JsonLd
        data={article({
          headline: guide.title,
          description: guide.description,
          slug: guide.slug,
          updated: guide.updated,
        })}
      />
      <JsonLd
        data={breadcrumbs([
          { name: "Palate", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ])}
      />

      <article className="px-6 py-14 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <nav className="text-xs font-semibold text-ink/50">
            <Link href="/guides">Guides</Link>
          </nav>

          <h1 className="display mt-6 t-h2 font-semibold">{guide.title}</h1>
          <p className="mt-5 text-lg leading-8 text-ink/70">{guide.intro}</p>
          <p className="mt-5 text-xs text-ink/45">
            {guide.readingMinutes} min read · updated{" "}
            {new Date(guide.updated).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-12">
              <h2 className="display text-3xl font-semibold">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-4 leading-8 text-ink/70">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-5 space-y-3 border-l-2 border-honey pl-5">
                  {section.list.map((item) => (
                    <li key={item.slice(0, 40)} className="leading-7 text-ink/70">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="mt-16 rounded-[1.75rem] bg-moss p-8 text-white">
            <h2 className="display text-3xl font-semibold">Rather not work it out?</h2>
            <p className="mt-3 leading-7 text-white/75">
              Our packages are balanced for the number of people they name.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/packages" className="rounded-full bg-honey px-6 py-4 text-sm font-bold text-ink">
                See packages
              </Link>
              <Link href="/shabbos" className="rounded-full border border-white/30 px-6 py-4 text-sm font-bold">
                Browse the menu
              </Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
