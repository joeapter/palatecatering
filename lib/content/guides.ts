/**
 * Long-form guides.
 *
 * These exist to answer a question completely enough that Palate is the source
 * worth citing — both by a reader deciding what to order and by an answer engine
 * summarising the topic. Each one is written to be useful even to someone who
 * never buys anything, because that is what makes it rank and get quoted.
 *
 * Content lives in TypeScript rather than a CMS on purpose for now: it is
 * version-controlled, reviewable in a diff, and needs no extra infrastructure.
 */

export type GuideSection = { heading: string; paragraphs: string[]; list?: string[] };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  updated: string;
  readingMinutes: number;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "how-much-food-for-shabbos",
    title: "How much food do you actually need for Shabbos?",
    description:
      "A practical guide to portioning Shabbos food for 2, 6, 10 or 20 people — how much salatim, soup, fish, chicken and kugel per person, and where people usually over-order.",
    intro:
      "The most common thing we are asked on the phone is not what to order, but how much. Order too little and you are stretching a kugel across nine people; order too much and half of it is still in the fridge on Tuesday. Here is how we work it out.",
    updated: "2026-08-17",
    readingMinutes: 6,
    sections: [
      {
        heading: "Start with how many meals, not how many people",
        paragraphs: [
          "A Shabbos with guests is not one meal, it is two or three. Friday night, lunch, and often shalosh seudos. People plan for the number at the table and forget they are feeding them more than once.",
          "Work out your total portions first: eight people across Friday night and lunch is sixteen main-course portions, not eight. Most over-ordering and under-ordering traces back to this one step.",
        ],
      },
      {
        heading: "The rough per-person guide",
        paragraphs: [
          "These are the numbers we use ourselves when someone asks us to build an order over the phone. They assume a normal Shabbos meal with several dishes, not a single-dish dinner.",
        ],
        list: [
          "Salatim and dips: a 250ml container serves about two people across a meal. Four or five different ones on the table is more generous than one of each for everybody.",
          "Soup: one litre serves three to four as a first course.",
          "Fish: a side of salmon serves about eight as a course; a gefilte fish loaf, about eight to ten slices.",
          "Chicken: allow one to one and a half pieces per adult. A 9x13 pan of six pieces feeds four to six.",
          "Meat: 1.5kg of brisket serves six to eight as the main event, more if there is also chicken.",
          "Kugel and sides: a 9x13 pan serves six to eight alongside other dishes.",
          "Composed salads: a 3-litre container serves eight to ten as a side.",
        ],
      },
      {
        heading: "Worked example: Friday night for ten",
        paragraphs: [
          "Ten adults, one meal, a normal spread. Four or five salatim (so around five 250ml containers), three litres of soup, one side of salmon, two 9x13 pans of chicken or 1.5kg of brisket plus one pan of chicken, two kugels and one large salad.",
          "That looks like a lot written down, and it is roughly right. The mistake people make is doubling the mains and keeping the salatim the same — in practice the starters and sides are what make a table feel full.",
        ],
      },
      {
        heading: "Where people usually go wrong",
        paragraphs: [
          "Three patterns come up again and again. Ordering one main per person, when a mixed table of chicken and meat means nobody eats a full portion of either. Under-ordering salatim, which are the cheapest way to make a table look abundant. And forgetting shalosh seudos entirely, then raiding the lunch leftovers.",
          "If you would rather not do this arithmetic at all, our packages are built to serve the number of people they name, with the balance between courses already worked out.",
        ],
      },
    ],
  },
  {
    slug: "reheating-your-order",
    title: "Reheating your Palate order for Shabbos",
    description:
      "How to reheat each type of dish — trays, soups, kugels, fish and salatim — including what to do before candle lighting and what should never be heated.",
    intro:
      "Everything we send is cooked and ready; the only job left is getting it hot without drying it out. This is dish by dish, plus what to do on Friday afternoon.",
    updated: "2026-08-17",
    readingMinutes: 4,
    sections: [
      {
        heading: "Before Shabbos",
        paragraphs: [
          "Take what you need out of the fridge about half an hour before you plan to heat it. Food that goes into the oven fridge-cold takes far longer and dries at the edges while the middle catches up.",
          "Heat covered at 160°C. Most 9x13 trays take 25 to 40 minutes. Keep the foil on — it is what stops the surface drying — and only take it off for the last five minutes if you want a crisper top.",
        ],
      },
      {
        heading: "Dish by dish",
        paragraphs: ["A few dishes want slightly different handling."],
        list: [
          "Chicken and meat in sauce: covered, 160°C, 30 to 40 minutes. Spoon some sauce over before it goes in.",
          "Schnitzel and anything crumbed: uncovered so it stays crisp, 180°C, 15 to 20 minutes.",
          "Kugels: covered, 160°C, 30 minutes. Potato kugel takes the longest.",
          "Soup: gently on the hob rather than the oven, and stir it as it comes up to heat.",
          "Salmon: it is already cooked through. Ten to fifteen minutes covered at 150°C is plenty — any more and it tightens.",
          "Salatim, dips and composed salads: serve cold, straight from the fridge. Never heat these.",
        ],
      },
      {
        heading: "On Shabbos itself",
        paragraphs: [
          "Transfer whatever you want hot for lunch onto your blech or hotplate before candle lighting, according to your family's practice. A tray that has been on a hotplate for hours will dry out, so a little extra sauce or a splash of water under the foil before Shabbos comes in makes a real difference.",
          "If you are unsure about anything halachically, ask your rav — we are cooks, not poskim.",
        ],
      },
    ],
  },
  {
    slug: "planning-a-kiddush",
    title: "Planning a kiddush: quantities, timing and what actually gets eaten",
    description:
      "How to plan a shul kiddush or simcha spread — what to serve, how much per person, and the practical timing that keeps the food looking good until the end.",
    intro:
      "A kiddush is a different problem from a Shabbos meal. People graze standing up, they eat far less than they would sitting down, and the table has to look untouched an hour after it opened. Here is how we plan them.",
    updated: "2026-08-17",
    readingMinutes: 5,
    sections: [
      {
        heading: "How much people actually eat standing up",
        paragraphs: [
          "Plan on about half of what the same person would eat sitting at a table. What matters much more than volume is variety and how the table looks — a kiddush with six well-presented things beats one with three big trays.",
          "For a shul kiddush of fifty, we would typically build around four or five salatim with fresh bread, a substantial meat item like deli roll or cigars, one composed salad, a kugel cut small, and something sweet.",
        ],
      },
      {
        heading: "The things that always run out first",
        paragraphs: [
          "Anything you can pick up without a plate goes first: cigars, deli roll, anything cut into squares. Dips with fresh bread go quickly too. Composed salads that need a fork and a plate go slowest.",
          "If budget is tight, put it into the handheld items and keep the fork-and-plate dishes modest. It will feel more generous for the same money.",
        ],
      },
      {
        heading: "Timing and presentation",
        paragraphs: [
          "Cut kugels and anything sliced before it goes out, not during. A tray that has to be cut in front of people looks picked-over within minutes.",
          "Hold back roughly a fifth of each item and refill part-way through rather than putting everything out at once. It costs nothing and the table looks full at the end rather than raided.",
          "If you tell us the headcount and the room, we will tell you honestly what we would order, including where to spend less.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
