/**
 * Event catering content.
 *
 * Every price, inclusion and package tier here was taken from the existing
 * Palate site (`bris.html`, `Corporate-Catering.html`, the events section of
 * `index.html`) rather than invented. Where the old site quoted no price — bar
 * and bat mitzvah, Shabbos simcha meals — none is stated here either; those are
 * quoted per event, and saying otherwise would set an expectation Palate has
 * not agreed to.
 */

export type PriceTier = { label: string; price: string; note?: string };
export type AddOnGroup = { group: string; items: { name: string; description: string; price: string }[] };
export type ProcessStep = { step: string; detail: string };

export type EventType = {
  slug: string;
  name: string;
  /** Short label for the catering hub grid and the header menu. */
  menuLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  image: string;
  metaDescription: string;
  included?: string[];
  menuHighlights?: string[];
  pricing?: { tiers: PriceTier[]; minimum?: string; note?: string };
  highlights?: { name: string; description: string }[];
  addOns?: AddOnGroup[];
  process?: ProcessStep[];
  /** True when the event is quoted individually rather than from a price list. */
  enquiryOnly?: boolean;
};

const BRIS_ADD_ONS: AddOnGroup[] = [
  {
    group: "Live stations",
    items: [
      { name: "Egg Station", description: "Fresh omelets made on site", price: "₪25 / person" },
      { name: "Pancake Station", description: "Fluffy pancakes with toppings", price: "₪20 / person" },
      { name: "Live Pizza Bar", description: "Hand-tossed pizzas with toppings", price: "₪69 / person" },
    ],
  },
  {
    group: "Fish",
    items: [
      { name: "Smoked Salmon", description: "Premium smoked salmon", price: "₪240 / 10 servings" },
      { name: "Salmon Side — Pesto", description: "Whole side, pesto glaze", price: "₪330 / side" },
      { name: "Salmon Side — Teriyaki", description: "Whole side, teriyaki glaze", price: "₪330 / side" },
      { name: "Salmon Side — Lemon Dill", description: "Whole side, lemon-dill glaze", price: "₪330 / side" },
    ],
  },
  {
    group: "Pasta trays",
    items: [
      { name: "Fettuccine Alfredo", description: "Creamy parmesan pasta", price: "₪260 / 9x13 pan" },
      { name: "Penne a la Vodka", description: "Classic tomato cream pasta", price: "₪260 / 9x13 pan" },
      { name: "Lasagna", description: "Layers of cheese and sauce", price: "₪260 / 9x13 pan" },
    ],
  },
  {
    group: "Quiche & salads",
    items: [
      { name: "Mini Quiches", description: "Assorted", price: "₪200 / 24 pieces" },
      { name: "Greek Salad", description: "Feta, cucumber, olives", price: "₪210 / bowl" },
      { name: "Caesar Salad", description: "Classic creamy caesar", price: "₪210 / bowl" },
      { name: "Sweet Potato & Halloumi Salad", description: "Roasted sweet potatoes and halloumi", price: "₪220 / bowl" },
    ],
  },
  {
    group: "Wraps",
    items: [
      { name: "Sweet Potato & Feta", description: "Roasted sweet potato and feta", price: "₪200 / 20 half wraps" },
      { name: "Pesto & Green Leaves", description: "Pesto with green leaves", price: "₪200 / 20 half wraps" },
      { name: "Goat Cheese & Pepper", description: "Roasted pepper and goat cheese", price: "₪200 / 20 half wraps" },
      { name: "Smoked Salmon", description: "Lemon zest cream cheese and onion", price: "₪200 / 20 half wraps" },
    ],
  },
  {
    group: "Boards & sweet",
    items: [
      { name: "Antipasto Board", description: "Marinated vegetables platter", price: "₪220 / 9x13 pan" },
      { name: "Cheesecakes", description: "Assorted flavors", price: "₪190 / by order" },
      { name: "Fruit Platters", description: "Fresh seasonal fruit", price: "₪280 / by order" },
    ],
  },
];

const SIMCHA_PROCESS: ProcessStep[] = [
  {
    step: "Share the details",
    detail:
      "Tell us the date, the venue, the guest count and any minhagim we should build around. We hold your slot and send sample menus.",
  },
  {
    step: "Shape the menu",
    detail:
      "Choose the base package and the add-ons, and we coordinate rentals, décor and delivery windows on your behalf.",
  },
  {
    step: "Relax on the day",
    detail:
      "Our team sets up, styles, replenishes through the event and clears down — the space is left spotless once the mazal tovs are done.",
  },
];

export const EVENT_TYPES: EventType[] = [
  {
    slug: "bris",
    name: "Bris Milah",
    menuLabel: "Bris",
    eyebrow: "Bris Milah & baby events",
    title: "A bris that runs itself.",
    intro:
      "An early morning, a full room, and a family who should not be plating food. We bring the buffet, the styling, the drinks and the team — and clear it all away afterwards.",
    image: "/assets/bris/pancake-station.jpg",
    metaDescription:
      "Bris catering in Beit Shemesh and Jerusalem from Palate — dairy buffet, live stations, full setup, styling and service, from ₪80 per person.",
    included: [
      "Chad paami — premium disposables throughout",
      "Tablecloth rental, delivered and collected",
      "Full hall and buffet setup, and breakdown afterwards",
      "Themed serving dishes and décor",
      "Balloon centerpiece installation",
      "Hot drink and cold beverage stations",
    ],
    menuHighlights: [
      "Assorted spread",
      "Cream cheeses with tuna and egg salads",
      "Veggie, Greek and Caesar salads",
      "Mini muffins and hand-crafted pastries",
    ],
    pricing: {
      tiers: [
        { label: "100+ guests", price: "₪80 / person" },
        { label: "80–99 guests", price: "₪85 / person" },
        { label: "60–79 guests", price: "₪95 / person" },
      ],
      minimum: "Minimum 60 guests",
      note: "Add-ons and live stations are priced separately, below.",
    },
    highlights: [
      {
        name: "Live Pancake Bar",
        description: "Fluffy pancakes finished with syrups, fruit and crumble toppings — for the children and, in practice, everyone else.",
      },
      {
        name: "Chef Omelet Station",
        description: "Made-to-order omelets and shakshuka, which is what an early morning bris actually needs.",
      },
      {
        name: "Artisanal Boards",
        description: "Antipasti, smoked salmon sides and composed salads, styled to look as good as they eat.",
      },
    ],
    addOns: BRIS_ADD_ONS,
    process: SIMCHA_PROCESS,
  },
  {
    slug: "bar-mitzvah",
    name: "Bar Mitzvah",
    menuLabel: "Bar Mitzvah",
    eyebrow: "Bar Mitzvah",
    title: "His simcha, done properly.",
    intro:
      "A leining Shabbos, a weeknight seudah, or a full hall — bar mitzvahs vary more than any other simcha we cater, so we quote each one around what the family actually wants.",
    image: "/assets/gallery/gallery1.jpg",
    metaDescription:
      "Bar Mitzvah catering in Beit Shemesh, Jerusalem and beyond — full-service menus, décor, staffing and on-site coordination from Palate and Elevate Events.",
    highlights: [
      { name: "Full-service catering", description: "Menus built with you, plus rentals, staff and on-site coordination." },
      { name: "Décor, flowers and balloons", description: "Custom florals, balloon installations and table styling through Elevate Events." },
      { name: "Lighting, branding and signage", description: "Lighting design and custom signage that make a hall feel like an occasion." },
    ],
    process: SIMCHA_PROCESS,
    enquiryOnly: true,
  },
  {
    slug: "bat-mitzvah",
    name: "Bat Mitzvah",
    menuLabel: "Bat Mitzvah",
    eyebrow: "Bat Mitzvah",
    title: "Elegant, and unmistakably hers.",
    intro:
      "From an intimate dairy lunch to a full evening celebration. We build the menu and the styling around her, and handle everything on the day so the family can be present for it.",
    image: "/assets/gallery/gallery2.jpg",
    metaDescription:
      "Bat Mitzvah catering and styling in Beit Shemesh and Jerusalem — dairy and meat menus, florals, décor and full-service hospitality from Palate.",
    highlights: [
      { name: "Dairy or meat menus", description: "Composed salads, live stations, pasta and boards, or a full meat seudah." },
      { name: "Styling that photographs", description: "Florals, balloons and table design arranged with an eye for warmth, not just luxury." },
      { name: "A team on the day", description: "Setup, service, replenishing and clear-down, so nobody in the family is working." },
    ],
    process: SIMCHA_PROCESS,
    enquiryOnly: true,
  },
  {
    slug: "shabbos-simcha",
    name: "Shabbos Simcha Meals",
    menuLabel: "Shabbos Simcha",
    eyebrow: "Shabbos family simcha meals",
    title: "A Shabbos for fifty, without a kitchen in sight.",
    intro:
      "Sheva brachos, an aufruf, a bar mitzvah Shabbos, or family in from overseas. Turnkey Shabbos catering with full table setups — delivered and set before candle lighting, because it has to be.",
    image: "/assets/gallery/gallery3.jpg",
    metaDescription:
      "Shabbos simcha catering in Beit Shemesh and Jerusalem — sheva brachos, aufruf and bar mitzvah Shabbos meals, delivered and set up before Shabbos.",
    highlights: [
      { name: "Every meal covered", description: "Friday night, lunch and shalosh seudos, portioned for the real headcount rather than guesswork." },
      { name: "Set up before Shabbos", description: "Everything delivered, plated and laid out ahead of candle lighting, with reheating instructions." },
      { name: "Table setups included", description: "Full table settings and styling available, so a rented hall or a home feels like a simcha." },
    ],
    process: SIMCHA_PROCESS,
    enquiryOnly: true,
  },
  {
    slug: "corporate",
    name: "Corporate & Institutional",
    menuLabel: "Corporate",
    eyebrow: "Corporate dining",
    title: "Feeding your people, reliably.",
    intro:
      "Chef-driven meals for offices, co-working hubs, schools and organisations — daily service or a one-off launch, with the logistics handled properly.",
    image: "/assets/gallery/gallery4.jpg",
    metaDescription:
      "Corporate catering in Israel from Palate — daily office meals, school and institutional programs, and corporate events, with kosher supervision and allergy tracking.",
    highlights: [
      {
        name: "Daily meal programs",
        description: "In-office breakfasts and lunches, grab-and-go fridges or plated service. We handle prep, labelling, delivery windows and cleanup.",
      },
      {
        name: "Schools & organisations",
        description: "Yeshivas, seminaries, camps and healthcare centres — weekly plans built around budgets, prep space and dietary expectations.",
      },
      {
        name: "Parties & launches",
        description: "Chef stations, passed bites and dessert programs, with an on-site culinary team and service captain.",
      },
    ],
    included: [
      "Kosher supervision available",
      "Allergy and nutrition tracking",
      "Multi-site delivery logistics",
      "Nutritional breakdowns for parents and administrators",
      "Optional Shabbos and Yom Tov add-ons",
    ],
    pricing: {
      tiers: [
        { label: "Daily Essentials", price: "₪50 / meal", note: "Recurring meals in offices, schools and production hubs. Minimum 20 servings per delivery window, including menu planning, packing and delivery." },
        { label: "Executive & Bespoke", price: "up to ₪280 / meal", note: "Tasting menus, dietary concierge service and onsite chefs, with staffing, styling and reporting built in." },
      ],
      note: "Hybrid programmes, seasonal pop-ups and once-a-week campus deliveries are all workable — tell us what you need.",
    },
  },
];

export function getEventType(slug: string): EventType | undefined {
  return EVENT_TYPES.find((event) => event.slug === slug);
}

export const TESTIMONIALS = [
  {
    quote:
      "Elevate made our daughter's Bat Mitzvah truly magical — from the flowers to the food, every detail was flawless.",
    attribution: "S. & R. Cohen, London",
  },
  {
    quote:
      "As overseas clients, we felt completely cared for. They coordinated every aspect of our simcha with grace and ease.",
    attribution: "A. Levi, New York",
  },
  {
    quote:
      "The staff were polished, warm, and professional — our guests still talk about how elegant it all felt.",
    attribution: "D. & R. Friedman, Jerusalem",
  },
];
