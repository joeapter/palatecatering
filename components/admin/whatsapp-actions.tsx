"use client";

import { useState } from "react";
import {
  buildMessage,
  whatsappLink,
  MESSAGE_LABELS,
  type MessageKind,
  type OrderSummary,
} from "@/lib/notifications/messages";

const KINDS: MessageKind[] = ["confirmed", "ready", "out_for_delivery"];

/**
 * Opens WhatsApp with the message already written, rather than sending it for
 * you. No API approval, no per-message cost, and staff see exactly what goes out
 * before it goes — which is the right trade while volume is small.
 */
export function WhatsappActions({ order }: { order: OrderSummary }) {
  const [open, setOpen] = useState(false);
  const hasPhone = Boolean(whatsappLink(order.customerPhone, "test"));

  if (!hasPhone) {
    return <p className="text-xs text-ink/40">No phone number on this order</p>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white"
      >
        WhatsApp
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink/15 bg-white shadow-xl">
          {KINDS.map((kind) => {
            const href = whatsappLink(order.customerPhone, buildMessage(kind, order));
            return (
              <a
                key={kind}
                href={href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-left text-xs font-semibold hover:bg-cream"
              >
                {MESSAGE_LABELS[kind]}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
