import Image from "next/image";
import Link from "next/link";

/**
 * Chanukah 2026 promotion, shown at the top of the home page in place of
 * nothing — the hero slider still follows it.
 *
 * It runs to the end of Monday 7 December, Israel time (22:00 UTC, Israel being
 * on winter time then), and disappears by itself after that: the home page is
 * regenerated every five minutes, so it is gone within five minutes of the
 * cutoff with no deploy needed.
 *
 * The whole block is one link to the Chanukah menu, so a tap anywhere on the
 * printed menu image or the button lands there.
 */
const SHOW_UNTIL = Date.parse("2026-12-07T22:00:00Z");

export function chanukahPromoIsLive(now: number = Date.now()) {
  return now < SHOW_UNTIL;
}

export function ChanukahPromo() {
  return (
    <section aria-label="Chanukah menu" className="bg-[#f4ebdc]">
      <Link
        href="/holidays/chanukah"
        className="focus-ring group mx-auto grid max-w-6xl items-center gap-5 px-4 py-6 sm:px-6 sm:py-10 md:grid-cols-2 md:gap-12 lg:px-10"
      >
        <Image
          src="/assets/chanukah/chanukah-menu-2026.jpg"
          alt="Palate Catering Chanukah menu: classic and sweet potato latkes ₪180, Ultimate Latke Platter ₪420, beef empanadas ₪240, egg rolls ₪225, scallion pancakes ₪225, Chinese fried rice ₪190, beer battered chicken nuggets ₪240, fried halloumi salad ₪240 (dairy)."
          width={1206}
          height={1310}
          priority
          sizes="(min-width: 768px) 520px, 100vw"
          className="mx-auto h-auto w-full max-w-[520px] rounded-2xl shadow-[0_18px_50px_-20px_rgba(60,40,15,.45)] transition duration-300 group-hover:-translate-y-0.5 md:max-h-[80vh] md:w-auto"
        />

        <div className="text-center md:text-left">
          <p className="text-xs font-bold tracking-[.3em] text-[#9a6a2c] uppercase">
            Now taking orders
          </p>
          <h2 className="display mt-3 hidden t-h2 font-semibold text-ink md:block">
            Chanukah, already fried.
          </h2>
          <p className="mt-4 hidden max-w-md leading-8 text-ink/70 md:block">
            Latkes by the fifteen, the Ultimate Latke Platter, empanadas, egg rolls, scallion
            pancakes and more — cooked in Ramat Beit Shemesh for the eight nights.
          </p>
          <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-extrabold text-white transition group-hover:bg-ink/90 sm:w-auto md:mt-8">
            Order Chanukah now
            <span aria-hidden className="transition group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>
    </section>
  );
}
