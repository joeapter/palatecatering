"use client";

import { useEffect, useState } from "react";

type SavedCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number; isExpired: boolean };

/**
 * Saved cards on the account page.
 *
 * Removal is the important half. A customer who cannot see and delete a stored
 * card has no way to withdraw consent, so this list exists as much for that as
 * for reassurance. The card details themselves live at Stripe — what is shown
 * here is only the brand, last four digits and expiry that Stripe hands back.
 */
export function SavedCards() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await fetch("/api/account/payment-methods").then((r) => r.json());
      setCards(data.cards || []);
    } catch {
      setCards([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(card: SavedCard) {
    const label = `${card.brand} ending ${card.last4}`;
    if (!window.confirm(`Remove your ${label}? You will need to enter it again next time.`)) return;
    setBusy(card.id); setError("");
    try {
      const response = await fetch("/api/account/payment-methods", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethodId: card.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "That card could not be removed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That card could not be removed.");
    } finally {
      setBusy("");
    }
  }

  if (cards === null) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">Saved cards</h2>
      {cards.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-ink/60">
          No saved cards. Tick “Save my card for next time” at checkout and your next order is one tap.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {cards.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4">
              <div>
                <p className="font-bold capitalize">{card.brand} •••• {card.last4}</p>
                <p className="text-xs text-ink/55 tabular-nums">
                  Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                  {card.isExpired && <span className="ml-2 font-bold text-clay">Expired</span>}
                </p>
              </div>
              <button
                onClick={() => remove(card)}
                disabled={busy === card.id}
                className="focus-ring rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold disabled:opacity-50"
              >
                {busy === card.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-ink/50">
        Cards are held by Stripe, our payment processor. Palate never stores your card number.
      </p>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}
