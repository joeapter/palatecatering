"use client";

import { useState } from "react";
import { useMessageTemplates } from "@/lib/hooks/use-message-templates";
import {
  buildMessage,
  smsLink,
  telLink,
  whatsappLink,
  type MessageKind,
  type OrderSummary,
} from "@/lib/notifications/messages";

const KINDS: MessageKind[] = ["confirmed", "ready", "out_for_delivery"];

/**
 * Call, text and WhatsApp a customer from the order row.
 *
 * Previously the only way to reach someone was a WhatsApp button, and the phone
 * number sat beside it as plain text you could not tap. On a phone that is the
 * wrong way round: the number should dial, and a text message should be as
 * quick as a WhatsApp — not everyone here uses WhatsApp, and for a delivery
 * running late an SMS is often the one that gets read.
 *
 * All three open the phone's own apps with the message already written, so
 * whoever sends it sees exactly what goes out first. Nothing is sent from the
 * server, which means no API approval and no per-message cost.
 */
export function ContactActions({ order }: { order: OrderSummary }) {
  const [pick, setPick] = useState<"sms" | "whatsapp" | null>(null);
  const { bodyFor, labelFor } = useMessageTemplates();

  const tel = telLink(order.customerPhone);
  const hasPhone = Boolean(tel);

  if (!hasPhone) {
    return <p className="text-xs text-ink/40">No phone number on this order</p>;
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <a
          href={tel!}
          className="focus-ring flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-xs font-bold"
        >
          <Phone /> Call
        </a>
        <button
          type="button"
          onClick={() => setPick(pick === "sms" ? null : "sms")}
          aria-expanded={pick === "sms"}
          className="focus-ring flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-xs font-bold"
        >
          <Message /> Text
        </button>
        <button
          type="button"
          onClick={() => setPick(pick === "whatsapp" ? null : "whatsapp")}
          aria-expanded={pick === "whatsapp"}
          className="focus-ring flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-bold text-white"
        >
          <Whatsapp /> WhatsApp
        </button>
      </div>

      {pick && (
        <>
          {/* Tapping anywhere else closes it — on a phone there is no cursor to
              move away, so a menu with no way out is a trap. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPick(null)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute right-0 left-0 z-30 mt-2 overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-xl">
            <p className="border-b border-ink/10 px-4 py-2 text-[10px] font-bold tracking-wider text-ink/50 uppercase">
              {pick === "sms" ? "Send a text" : "Send on WhatsApp"}
            </p>
            {KINDS.map((kind) => {
              const message = buildMessage(kind, order, bodyFor(kind));
              const href = pick === "sms"
                ? smsLink(order.customerPhone, message)
                : whatsappLink(order.customerPhone, message);
              return (
                <a
                  key={kind}
                  href={href ?? "#"}
                  target={pick === "whatsapp" ? "_blank" : undefined}
                  rel={pick === "whatsapp" ? "noreferrer" : undefined}
                  onClick={() => setPick(null)}
                  className="block border-b border-ink/5 px-4 py-3.5 text-sm font-semibold last:border-0 active:bg-ink/5"
                >
                  {labelFor(kind)}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Phone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="none">
      <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 7.2 2 2 0 0 1 6 5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Message() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="none">
      <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Whatsapp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.4A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-5.9-5.2c-.4-.7-.7-1.5-.7-2.2 0-.8.4-1.5.9-1.9.2-.2.4-.2.6-.2h.5c.2 0 .4 0 .6.4l.8 1.9c0 .2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.6 3.1c.3.2.5.1.6 0l.8-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3v.9Z" />
    </svg>
  );
}
