import { defaultFor, renderTemplate } from "./templates";
/**
 * Customer message templates.
 *
 * WhatsApp is the channel that actually gets read by this customer base, and
 * `wa.me` links cost nothing and need no API approval — staff tap a button and
 * their own WhatsApp opens with the message written. That is deliberately the
 * starting point; the Business API can replace the transport later without
 * these templates changing.
 */

export type OrderSummary = {
  orderNumber: number | string;
  /** For the holiday announcement: which menu, and where it lives. */
  holidayLabel?: string | null;
  holidayPath?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  total?: string | number | null;
  windowLabel?: string | null;
  items?: Array<{ title?: string; quantity?: number }>;
};

const BUSINESS_PHONE = "058-728-0062";

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
 * Israeli mobile numbers are typed locally (05X-XXX-XXXX) but wa.me needs E.164
 * without a plus. Anything already international is left alone.
 */
export function toWhatsappNumber(raw?: string | null): string | null {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  // Bare local number without the leading zero.
  if (digits.length === 9) return `972${digits}`;
  return digits;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const number = toWhatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Dialable form, for a plain tap-to-call link. */
export function telLink(phone: string | null | undefined): string | null {
  const number = toWhatsappNumber(phone);
  return number ? `tel:+${number}` : null;
}

/**
 * Opens the phone's own Messages app with the text already written.
 *
 * The `?&body=` is not a typo. iOS historically wanted `&body=` and Android
 * wants `?body=`; `?&body=` is the one form both accept, and it is what makes a
 * single link work on whichever phone happens to be in your hand.
 */
export function smsLink(phone: string | null | undefined, message: string): string | null {
  const number = toWhatsappNumber(phone);
  if (!number) return null;
  return `sms:+${number}?&body=${encodeURIComponent(message)}`;
}

export type MessageKind = "confirmed" | "ready" | "out_for_delivery" | "cutoff_reminder" | "holiday_menu";

// Imported after the type it depends on, since templates.ts refers back to it.


/**
 * Builds a customer message.
 *
 * `template` is the owner's edited wording from the admin. Without one the
 * shipped default is used, so a missing row or an unreachable database sends
 * the original message rather than nothing.
 */
export function buildMessage(kind: MessageKind, order: OrderSummary, template?: string): string {
  return renderTemplate(template || defaultFor(kind).body, order);
}

export const MESSAGE_LABELS: Record<MessageKind, string> = {
  confirmed: "Confirm order",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  cutoff_reminder: "Cutoff reminder",
  holiday_menu: "Holiday menu is up",
};
