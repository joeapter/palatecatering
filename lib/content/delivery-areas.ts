/**
 * Where Palate delivers, by neighbourhood.
 *
 * The point of naming places individually rather than writing "Jerusalem and
 * surrounding areas" is that people — and the assistants they ask — search for
 * the neighbourhood, not the city. "Does anyone deliver Shabbos food to Old
 * Katamon" only finds you if the words "Old Katamon" are on the page.
 *
 * The zone `slug` matches the delivery zone in the database, so the fees shown
 * on the page are the live ones from the admin rather than a second copy that
 * can drift out of date.
 */

export type DeliveryArea = {
  /** Matches delivery_zones.slug so prices come from one source. */
  slug: string;
  title: string;
  blurb: string;
  /** Named areas. Order is roughly by how many customers come from each. */
  areas: string[];
};

export const DELIVERY_AREAS: DeliveryArea[] = [
  {
    slug: "beit-shemesh",
    title: "Beit Shemesh & Ramat Beit Shemesh",
    blurb:
      "Our own city, and where most of our orders go. Deliveries run before Shabbos and Yom Tov, and pickup from the kitchen is always an option.",
    areas: [
      "Ramat Beit Shemesh Alef",
      "Ramat Beit Shemesh Bet",
      "Ramat Beit Shemesh Gimmel (1 and 2)",
      "Ramat Beit Shemesh Daled / Neve Shamir",
      "Sheinfeld",
      "Nofei Aviv",
      "Old Beit Shemesh (Ir Atika)",
      "Givat Sharett",
      "Migdal HaMayim",
      "Mishkafayim",
      "Ramat Avraham",
      "Nachala U'Menucha",
      "Har Tuv",
    ],
  },
  {
    slug: "jerusalem",
    title: "Jerusalem & surrounding areas",
    blurb:
      "Across Jerusalem and out to Efrat, Gush Etzion, Maale Adumim and Mevaseret Zion — all at the same delivery rate.",
    areas: [
      "Har Nof",
      "Bayit Vegan",
      "Rechavia",
      "Old Katamon",
      "Katamon",
      "Baka",
      "Arnona",
      "German Colony",
      "Greek Colony",
      "Talbiya",
      "Shaarei Chesed",
      "Nachlaot",
      "City Centre",
      "Mamilla",
      "French Hill",
      "Ramat Eshkol",
      "Maalot Dafna",
      "Sanhedria",
      "Sanhedria Murchevet",
      "Ramat Shlomo",
      "Ramot (Alef to Daled, and Ramot Polin)",
      "Givat Shaul",
      "Kiryat Moshe",
      "Beit Hakerem",
      "Givat Mordechai",
      "Rassco",
      "San Simon",
      "Talpiot",
      "East Talpiot (Armon HaNatziv)",
      "Abu Tor",
      "Gilo",
      "Har Homa",
      "Malcha",
      "Kiryat HaYovel",
      "Kiryat Menachem",
      "Ir Ganim",
      "Ein Kerem",
      "Mekor Baruch",
      "Geula",
      "Mea Shearim",
      "Romema",
      "Neve Yaakov",
      "Pisgat Ze'ev",
      "Har Hotzvim",
      "Efrat",
      "Gush Etzion — Alon Shvut, Neve Daniel, Elazar, Bat Ayin, Rosh Tzurim, Kfar Etzion",
      "Maale Adumim",
      "Mevaseret Zion",
    ],
  },
  {
    slug: "modiin",
    title: "Modiin & the Modiin area",
    blurb:
      "Modiin and the surrounding communities, including the English-speaking neighbourhoods just outside the city.",
    areas: [
      "Buchman",
      "Chashmonaim",
      "Nof Ayalon",
      "Kiryat Sefer (Modiin Illit)",
      "Kaiser",
      "Moriah",
      "Nofim",
      "Shimshoni",
      "Reut",
      "Maccabim",
      "Lapid",
      "Kfar Ruth",
    ],
  },
];
