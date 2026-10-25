"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TEMPLATES, type StoredTemplate } from "@/lib/notifications/templates";
import type { MessageKind } from "@/lib/notifications/messages";

/**
 * The owner's edited message wording, for the screens that send messages.
 *
 * Starts from the shipped defaults so a button is never dead while the fetch is
 * in flight, and keeps them if the fetch fails. Every caller sends a real
 * message to a real customer; none of them should ever be blank because a
 * request was slow.
 */
export function useMessageTemplates() {
  const [templates, setTemplates] = useState<Record<string, StoredTemplate>>(() =>
    Object.fromEntries(DEFAULT_TEMPLATES.map((t) => [t.key, { key: t.key, label: t.label, body: t.body, enabled: true }])),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/messages")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.templates) return;
        setTemplates(Object.fromEntries(data.templates.map((t: StoredTemplate) => [t.key, t])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return {
    /** The edited body for a message, or undefined to use the shipped default. */
    bodyFor: (kind: MessageKind) => templates[kind]?.body,
    /** The button wording. */
    labelFor: (kind: MessageKind) => templates[kind]?.label ?? kind,
    /** Whether a switchable message should be offered at all. */
    enabledFor: (kind: MessageKind) => templates[kind]?.enabled !== false,
  };
}
