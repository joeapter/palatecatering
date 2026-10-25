/**
 * Customer reviews, quoted from the Google Business Profile.
 *
 * Kept as a small file rather than a database table on purpose: reviews arrive
 * a few times a year, they are quoted verbatim from a public source, and a
 * table with an editor would be more machinery than the job needs. Add a new
 * one here as it comes in.
 *
 * Deliberately NOT marked up as AggregateRating or Review structured data.
 * Google stopped supporting self-serving review markup — a business rating
 * itself on its own site — for LocalBusiness and Organization in 2019, and
 * emitting it risks a manual action against the whole site. The rating lives on
 * the Google profile where it belongs; this page quotes it and links there, so
 * the star rating is corroborated by the source rather than asserted by us.
 */

export type Testimonial = {
  name: string;
  /** Out of five, as left on Google. */
  rating: number;
  quote: string;
  /** Roughly when, for honesty about how current the reviews are. */
  when: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Aliza Mitnick",
    rating: 5,
    when: "August 2026",
    quote:
      "Palate Catering is the most incredible company. The food is always fresh, packaged so nicely, and absolutely delicious every time! They made my first year of Aliyah a breeze with Shabbos/yuntif takeout and events! Maya and her staff are a pleasure to work with and always looking to accommodate and help! Beit Shemesh is so lucky to have them!",
  },
];

/**
 * The Google Business Profile, by its CID.
 *
 * Taken from the share link for the first review, which is the only place the
 * id was exposed — a `share.google` link points at one review rather than the
 * business, so it is the wrong thing to send a customer. Verified in a browser
 * that this opens "Palate Catering" and not a neighbouring listing.
 */
const GOOGLE_CID = "9846963921680194382";

/** Reads the profile, where all reviews and the live rating are shown. */
export const GOOGLE_REVIEWS_URL = `https://www.google.com/maps?cid=${GOOGLE_CID}`;

/**
 * Opens the review box directly — the short link from Google Business Profile
 * → Ask for reviews. Worth keeping separate from the profile link: the moment
 * to ask is the order confirmation, while the food is still on the table.
 */
export const GOOGLE_WRITE_REVIEW_URL = "https://g.page/r/CU7b1euDcaeIEAE/review";
