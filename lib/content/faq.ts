/**
 * The questions people actually phone and WhatsApp about.
 *
 * Answers are written to stand alone, because this is the text an answer engine
 * quotes when someone asks Google or ChatGPT about kosher Shabbos food in Beit
 * Shemesh. Anything vague here becomes a vague answer somewhere else.
 *
 * Where a number is a policy Palate must confirm, the wording deliberately
 * points to the live source (checkout, the menu page) instead of stating a
 * figure that could go stale.
 */

export type FaqEntry = { question: string; answer: string; group: string };

export const FAQ: FaqEntry[] = [
  {
    group: "Ordering",
    question: "When do I need to order by for Shabbos?",
    answer:
      "Each week has its own cutoff, and it is shown on the menu and at checkout before you pay. Once a week closes, the site stops accepting orders for that date and moves you to the next available one. If you have missed the cutoff and are stuck, call 058-728-0062 — we will tell you honestly whether we can still fit it in.",
  },
  {
    group: "Ordering",
    question: "Can I change or cancel an order after placing it?",
    answer:
      "Yes, as long as the week has not closed and we have not started cooking. Call or WhatsApp 058-728-0062 with your order number and we will sort it out. After the cutoff the food is already planned and bought, so changes may not be possible.",
  },
  {
    group: "Ordering",
    question: "Do I need an account to order?",
    answer:
      "No. You can order as a guest. Creating an account simply keeps your order history, so repeating last week's order takes one tap instead of rebuilding it dish by dish.",
  },
  {
    group: "Delivery & pickup",
    question: "Where do you deliver?",
    answer:
      "We deliver across Beit Shemesh and Ramat Beit Shemesh, and to Jerusalem, Modiin, Mevaseret Zion, Telzstone and Beitar Illit. Delivery areas and their fees are listed at checkout when you choose delivery, along with any minimum order for that area.",
  },
  {
    group: "Delivery & pickup",
    question: "How much is delivery?",
    answer:
      "It depends on the area, and the exact fee is shown at checkout before you pay. Larger orders in some areas qualify for free delivery, and the cart tells you how close you are to that threshold as you shop.",
  },
  {
    group: "Delivery & pickup",
    question: "Can I collect my order instead?",
    answer:
      "Yes. Choose pickup at checkout and there is no delivery charge. We will confirm the collection time with you, and message you when the order is packed and ready.",
  },
  {
    group: "Kashrus",
    question: "What is your hechsher?",
    answer:
      "Palate is Mehadrin. Our certification, including the certificate itself, is on the Kashrus page of this site. If you need something specific confirmed for your family or your rav, call 058-728-0062 and we will give you the details directly.",
  },
  {
    group: "Kashrus",
    question: "Is the food Pas Yisroel and Bishul Yisroel?",
    answer:
      "Our kitchen operates to a Mehadrin standard. For the specific detail on any dish, please see the Kashrus page or contact us — we would rather answer precisely than have you assume.",
  },
  {
    group: "Food & portions",
    question: "How much food should I order per person?",
    answer:
      "As a rough guide for a Shabbos meal: allow around 250ml of each salatim between two people, one litre of soup for three to four, and a 9x13 pan of a main for six to eight. Our packages are already balanced for the number of people they name, which is the simplest way to avoid over- or under-ordering.",
  },
  {
    group: "Food & portions",
    question: "What size is a 9x13 pan?",
    answer:
      "A 9x13 pan is the standard rectangular foil tray, roughly 23cm by 33cm. It generally serves six to eight people as part of a meal with other dishes, or four to five if it is the only main.",
  },
  {
    group: "Food & portions",
    question: "Can you handle allergies?",
    answer:
      "Tell us at checkout in the notes and we will do our best. Our kitchen handles nuts, sesame, dairy and gluten, so we cannot guarantee an allergen-free environment. For a serious allergy please call 058-728-0062 before ordering so we can be straight with you about what is safe.",
  },
  {
    group: "Food & portions",
    question: "How do I reheat the food?",
    answer:
      "Most dishes arrive in oven-ready foil trays. Reheat covered at 160°C until hot through — usually 25 to 40 minutes depending on the dish and how cold it is. Salatim, dips and composed salads are served cold and should not be heated. For Shabbos, transfer to your blech or hotplate before candle lighting according to your family's practice.",
  },
  {
    group: "Payment",
    question: "How do I pay?",
    answer:
      "Payment is by card at checkout, handled securely by Stripe. We never see or store your card details. You will get an emailed confirmation as soon as the payment goes through.",
  },
  {
    group: "Payment",
    question: "I paid but did not get a confirmation email — what now?",
    answer:
      "Check your spam folder first. If it is not there, call or WhatsApp 058-728-0062 with the name and phone number you ordered under and we will confirm we have your order. Your payment is safe either way — we can always see it on our side.",
  },
  {
    group: "Events",
    question: "Do you cater simchas and corporate events?",
    answer:
      "Yes. Bris, kiddush, sheva brachos, corporate lunches and larger simchas are a significant part of what we do. Those are quoted individually rather than ordered off the weekly menu — see the Catering page or call 058-728-0062 to talk it through.",
  },
];

export const FAQ_GROUPS = [...new Set(FAQ.map((entry) => entry.group))];
