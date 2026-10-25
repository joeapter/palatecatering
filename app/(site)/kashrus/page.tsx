import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Kashrus & Hashgacha",
  description: "Palate Catering’s kashrus standards under Rabbi Lewin, including accepted hechsherim and policy information.",
};

const hechsherim = [
  { image: "badatz-eidah.png", name: "Badatz Eidah Chareidis", note: "Acceptable for use without issue." },
  { image: "rubin.png", name: "Badatz Mehadrin (Rav Rubin)", note: "Acceptable for use without issue." },
  { image: "sheiris.png", name: "Sheiris Yisroel", note: "Acceptable for use." },
  { image: "kehilos.png", name: "Kehilos", note: "Acceptable for use without issue for meat and chicken only." },
  { image: "landau.png", name: "Landau", note: "Acceptable for use." },
  { image: "tenuva.png", name: "Vaadat Mehadrin of Tenuva (Dairy)", note: "Acceptable for use without issue." },
  { image: "beefland.png", name: "“Beefland” meats — Rav Shmuel Aryeh Levine", note: "Acceptable for use without issue.", hebrew: "בשחיטה מהודרת של הרה״ג שמואל אריה לוין שליט״א ראש ישיבת חפץ חיים בארגנטינה" },
  { image: "gross.png", name: "Chicken under Rav Mordechai Gross shlit”a", note: "Chicken with the hechsher of Rav Mordechai Gross is acceptable for use without issue." },
] as const;

export default function KashrusPage() {
  return (
    <main className="px-6 py-16 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <Image src="/Hechsher.png" alt="Rabbi Lewin’s Mehadrin certification" width={150} height={150} className="mx-auto h-28 w-auto object-contain" priority />
          <p className="mt-8 text-xs font-bold tracking-[.25em] text-clay uppercase">Kashrus & hashgacha</p>
          <h1 className="display mt-3 t-h1 font-semibold">Kashrus information from Rabbi Lewin</h1>
          <p className="mx-auto mt-5 max-w-2xl leading-8 text-ink/60">Rabbi Lewin’s Mehadrin hechsher allows the following hechsherim for ingredients used by Palate.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink/60">For additional information, contact Rabbi Lewin directly at <a className="font-bold text-ink underline decoration-honey underline-offset-4" href="tel:+19172137932">+1 (917) 213-7932</a>.</p>
        </header>

        <section className="mt-16" aria-labelledby="accepted-heading">
          <div className="border-b border-ink/15 pb-5"><p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Ingredient standards</p><h2 id="accepted-heading" className="display mt-2 t-h3 font-semibold">Accepted hechsherim</h2></div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {hechsherim.map((item) => (
              <article key={item.name} className="flex min-h-36 items-center gap-5 rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_12px_40px_rgba(24,37,31,.05)]">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-white p-1">
                  <Image src={`/assets/Kashrus/${item.image}`} alt={`${item.name} logo`} width={80} height={80} className="max-h-16 w-auto object-contain" />
                </div>
                <div><h3 className="font-bold leading-6">{item.name}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{item.note}</p>{"hebrew" in item && <p lang="he" dir="rtl" className="mt-2 text-sm leading-6 text-ink/70">{item.hebrew}</p>}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl bg-moss p-7 text-white sm:p-9">
          <p className="text-xs font-bold tracking-[.25em] text-honey uppercase">Additional policies</p>
          <h2 className="display mt-2 text-3xl font-semibold">Read the complete policy</h2>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
            <a className="focus-ring rounded-full bg-cream px-5 py-3 text-ink" href="https://torahkollel.com/#section-slRQUic15" target="_blank" rel="noreferrer">Rabbi’s hechsher policy page</a>
            <a className="focus-ring rounded-full border border-white/30 px-5 py-3" href="https://docs.google.com/document/d/1Kxg7N3XJp5r4Y08sU5TyIZp5orrI-g5ihRygFlFQvmw/edit?tab=t.0" target="_blank" rel="noreferrer">Full kashrus policy document</a>
          </div>
        </section>
      </div>
    </main>
  );
}
