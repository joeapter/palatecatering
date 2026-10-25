import { TESTIMONIALS, GOOGLE_REVIEWS_URL } from "@/lib/content/testimonials";

/**
 * What customers say, quoted from Google.
 *
 * Placed after the menu rather than above it: someone who has just seen the
 * food is deciding whether to trust a kitchen they have not used, which is the
 * moment a review answers something. Above the menu it would be decoration.
 *
 * The stars are drawn, not marked up as structured data — see the note in
 * lib/content/testimonials.ts for why asserting your own rating is a risk.
 */
export function Testimonials() {
  if (!TESTIMONIALS.length) return null;

  return (
    <section className="border-y border-ink/10 bg-cream px-5 py-14 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">From our customers</p>
        <h2 className="display t-h2 mt-3 font-semibold">Cooked for real tables.</h2>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {TESTIMONIALS.map((review) => (
            <li key={review.name} className="rounded-[1.75rem] border border-ink/10 bg-white p-6 sm:p-7">
              <Stars rating={review.rating} />
              <blockquote className="mt-4 leading-7 text-ink/80">“{review.quote}”</blockquote>
              <p className="mt-5 text-sm font-bold">{review.name}</p>
              <p className="text-xs text-ink/50">Google review · {review.when}</p>
            </li>
          ))}
        </ul>

        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noreferrer"
          className="focus-ring mt-8 inline-block rounded-full border border-ink/25 bg-white px-6 py-3.5 text-sm font-bold"
        >
          Read our reviews on Google
        </a>
      </div>
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 20 20" aria-hidden="true" className={`size-4 ${index < rating ? "fill-honey" : "fill-ink/15"}`}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
        </svg>
      ))}
    </span>
  );
}
