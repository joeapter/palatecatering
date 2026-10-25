import type { MessageKind, OrderSummary } from "./messages";

/**
 * The message templates, and how a template becomes a message.
 *
 * Wording lives in the database so it can be edited in the admin, but the
 * defaults below ship with the code and are used whenever a stored template is
 * missing or the database is unreachable. A customer message must never come
 * out blank because a lookup failed.
 */

export type TemplateMeta = {
  key: MessageKind;
  label: string;
  body: string;
  /** What it is for, shown in the composer. */
  description: string;
  /** Which placeholders make sense here, so the composer can offer the right ones. */
  placeholders: string[];
};

const PHONE = "058-728-0062";

export const DEFAULT_TEMPLATES: TemplateMeta[] = [
  {
    key: "confirmed",
    label: "Confirm order",
    description: "Sent when an order comes in, to tell the customer it is safely with you.",
    placeholders: ["name", "order", "window", "total", "phone"],
    body: `Hi {name}, it's Palate.\n\nWe've got your order #{order}{window}{total}.\nWe'll message you again when it's ready.\n\nAny questions, just reply here or call {phone}.`,
  },
  {
    key: "ready",
    label: "Ready for pickup",
    description: "Sent when the order is made and waiting to be collected.",
    placeholders: ["name", "order", "phone"],
    body: `Hi {name}, your Palate order #{order} is ready for pickup.\n\nSee you soon — and if you're running late, just let us know here.`,
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    description: "Sent when the order leaves with the driver.",
    placeholders: ["name", "order", "phone"],
    body: `Hi {name}, your Palate order #{order} is on its way.\n\nPlease make sure someone can take it in. If you need to redirect the driver, reply here.`,
  },
  {
    key: "cutoff_reminder",
    label: "Cutoff reminder",
    description: "Sent from Customers to people who have not ordered for the week yet.",
    placeholders: ["name", "window", "phone"],
    body: `Hi {name}, it's Palate.\n\nOrdering{window} closes soon. If you'd like anything this week, now's the time.\n\nOrder here: https://www.palatecateringisrael.com/shabbos`,
  },
  {
    key: "holiday_menu",
    label: "Sukkos menu",
    description: "Announces that a holiday menu is up. Edit the wording and the link when the next menu goes live, and rename the button to match.",
    placeholders: ["name", "phone"],
    body: `Hi {name}, it's Palate.\n\nOur Sukkos menu is now up. Have a look while there is still room in the kitchen — we cook to order and the run fills up before Yom Tov.\n\nhttps://www.palatecateringisrael.com/holidays/sukkos\n\nAny questions, just reply here or call ${PHONE}.`,
  },
];

export type StoredTemplate = { key: string; label: string; body: string; enabled: boolean };

export function defaultFor(key: MessageKind): TemplateMeta {
  return DEFAULT_TEMPLATES.find((t) => t.key === key) || DEFAULT_TEMPLATES[0];
}

function firstName(name?: string | null): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function money(total?: string | number | null): string {
  const numeric = Number(String(total ?? "0").replace(/[^0-9.]/g, ""));
  return `₪${numeric.toFixed(2)}`;
}

/**
 * Fills a template.
 *
 * `{window}` and `{total}` carry their own leading separator and vanish
 * entirely when there is nothing to show — otherwise a message written for a
 * full order reads "your order # for  — ₪0.00" when sent from the kitchen,
 * which has neither figure. Unknown placeholders are left alone rather than
 * blanked, so a typo is visible in the preview instead of silently deleting
 * text.
 */
export function renderTemplate(body: string, order: OrderSummary): string {
  const values: Record<string, string> = {
    name: firstName(order.customerName),
    order: String(order.orderNumber ?? ""),
    window: order.windowLabel ? ` for ${order.windowLabel}` : "",
    total: order.total == null || order.total === "" ? "" : ` — ${money(order.total)}`,
    phone: PHONE,
  };
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

/** The placeholders the composer offers, with a plain description of each. */
export const PLACEHOLDER_HELP: Record<string, string> = {
  name: "The customer's first name, or “there” if unknown",
  order: "The order number",
  window: "“ for Shabbos · Aug 21” — disappears if unknown",
  total: "“ — ₪450.00” — disappears if unknown",
  phone: "Your business phone number",
};
