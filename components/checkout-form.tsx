"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStorefront } from "./storefront-provider";
import { attachCartContact, currentCartId } from "./cart-recovery";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) : null;

type SavedCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number; isExpired: boolean };
type Account = { id: number; email: string; name?: string | null; phone?: string | null; address?: string | null };

function cardLabel(card: SavedCard) {
  const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return `${brand} •••• ${card.last4}`;
}

export function CheckoutForm() {
  const { cart, orderContext, openOrderChooser } = useStorefront();
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [error, setError] = useState("");
  /** Set when the failure is one the date picker can fix, so the error is not a dead end. */
  const [fixWithChooser, setFixWithChooser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "" });
  const [notes, setNotes] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const [account, setAccount] = useState<Account | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [chosenCard, setChosenCard] = useState("");
  const [saveCard, setSaveCard] = useState(true);

  const paymentRef = useRef<HTMLDivElement>(null);

  /**
   * The basket the current payment was priced against.
   *
   * The cart stays open from the header on this page, so between "Continue to
   * secure payment" and tapping Pay a customer can still add a kugel or remove
   * a soup. The PaymentIntent is fixed at the moment it is created, so they
   * would be charged the old total while the summary beside it shows the new
   * basket — and if they removed something, charged for food they took out.
   *
   * Derived rather than held in state: any drift simply takes the card form
   * away and puts the Continue button back, which re-prices on the server.
   */
  const priceBasis = JSON.stringify({
    lines: cart.map((line) => [line.key, line.quantity]),
    window: orderContext?.orderWindow.id,
    fulfillment: orderContext?.fulfillment,
    zone: orderContext?.deliveryZone?.id,
  });
  const [pricedBasis, setPricedBasis] = useState("");
  const stale = Boolean(clientSecret) && Boolean(pricedBasis) && priceBasis !== pricedBasis;

  /**
   * What the customer is about to pay.
   *
   * This page listed the items and their prices but never showed a total, so
   * the last thing anyone saw before tapping Pay was a card field — Stripe's
   * PaymentElement does not display the amount. Asking for a card without
   * naming the figure is where people leave.
   *
   * Once the server has priced the order its `summary` is used instead, because
   * that is the figure the card will actually be charged.
   */
  const [summary, setSummary] = useState<{ subtotal: number; deliveryFee: number; total: number } | null>(null);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const zone = orderContext?.deliveryZone;
  const estimatedDelivery = orderContext?.fulfillment === "delivery" && zone && (!zone.free_delivery_threshold || subtotal < Number(zone.free_delivery_threshold)) ? Number(zone.fee) : 0;
  const totals = summary && !stale
    ? summary
    : { subtotal, deliveryFee: estimatedDelivery, total: subtotal + estimatedDelivery };

  /**
   * A signed-in customer should not retype what the account already knows, and
   * their saved cards decide which payment UI to show. Both are optional: a
   * failure here leaves the ordinary guest checkout untouched.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null));
        const user: Account | null = me?.user || null;
        if (cancelled || !user) return;
        setAccount(user);
        setCustomer((current) => ({
          name: current.name || user.name || "",
          email: current.email || user.email || "",
          phone: current.phone || user.phone || "",
          address: current.address || user.address || "",
        }));
        const cards = await fetch("/api/account/payment-methods").then((r) => (r.ok ? r.json() : { cards: [] }));
        if (cancelled) return;
        const usable: SavedCard[] = (cards.cards || []).filter((c: SavedCard) => !c.isExpired);
        setSavedCards(usable);
        if (usable.length) setChosenCard(usable[0].id);
      } catch {
        // Guest checkout stands on its own.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // On a phone the two columns stack, so the card field appears roughly a
  // screen and a half below the button that summoned it — tapping "Continue"
  // looked like nothing had happened. Bring it into view instead.
  useEffect(() => {
    if (clientSecret) paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [clientSecret]);

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setFixWithChooser(false);
    if (!orderContext) { openOrderChooser(); return; }
    setLoading(true);

    // Record the cart with contact details *before* asking for payment. This is
    // the single most valuable moment for recovery: they have told us who they
    // are and are one step from paying, so a cart abandoned from here is worth
    // following up and now can be.
    void attachCartContact({
      ...customer,
      status: "checkout_started",
      orderWindowId: orderContext.orderWindow.id,
      windowLabel: orderContext.orderWindow.name,
      fulfillment: orderContext.fulfillment,
      // `bundleId` travels with the line: lib/cart-lines.ts rebuilds a basket
      // from these rows, so without it a recovery email would restore the
      // basket minus its package — the most expensive thing in it.
      items: cart.map((line) => ({ title: line.title, quantity: line.quantity, unitPrice: line.unitPrice, variantLabel: line.variantLabel, productId: line.productId, variantId: line.variantId, bundleId: line.bundleId, image: line.image })),
    });

    trackBeginCheckout(
      cart.map((line) => ({ id: line.productId ?? line.bundleId, title: line.title, price: line.unitPrice, quantity: line.quantity, variant: line.variantLabel })),
      cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    );

    const response = await fetch("/api/checkout/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // A package has no productId, and sending one line shape for both is
        // what made every basket containing a package die on "A cart item is
        // invalid." The server has always priced bundles correctly; the browser
        // simply never sent the id.
        lines: cart.map((line) =>
          line.bundleId
            ? { bundleId: line.bundleId, quantity: line.quantity }
            : { productId: line.productId, variantId: line.variantId, quantity: line.quantity },
        ),
        orderWindowId: orderContext.orderWindow.id,
        fulfillment: orderContext.fulfillment,
        deliveryZoneId: orderContext.deliveryZone?.id,
        customer, notes, deliveryNotes,
        // Lets the completed payment mark this exact cart recovered.
        cartId: currentCartId(),
        // Only ever true for a signed-in customer who asked for it; the server
        // checks that again rather than trusting this.
        saveCard: Boolean(account) && saveCard,
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Unable to prepare payment.");
      // A closed date or a withdrawn delivery area is one tap from being fixed.
      // Leaving the customer looking at an error with a full basket and no
      // control is how an order that was ready to pay gets abandoned instead.
      if (data.code === "window_closed" || data.code === "zone_invalid") {
        setFixWithChooser(true);
        openOrderChooser();
      }
      return;
    }
    setClientSecret(data.clientSecret);
    setPaymentIntentId(data.paymentIntentId);
    setPricedBasis(priceBasis);
    if (data.summary) setSummary(data.summary);
  }

  if (!cart.length) {
    return <div className="rounded-3xl border border-ink/10 bg-white p-8 text-sm">Your cart is empty. Add something from the Shabbos menu first.</div>;
  }

  // A stale basket takes the card form away until the total is recalculated.
  const showCardEntry = clientSecret && stripePromise && !stale;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.85fr]">
      <form onSubmit={prepare} className="rounded-3xl border border-ink/10 bg-white p-6 sm:p-8">
        <h2 className="display t-h3 font-semibold">Your details</h2>
        {account && <p className="mt-2 text-xs text-ink/55">Signed in as {account.email}.</p>}

        {/* Without a date there is nothing to check out against, and finding
            that out only after filling the form is a wasted trip. */}
        {!orderContext && (
          <div className="mt-5 rounded-xl border border-clay/30 bg-clay/10 p-4">
            <p className="text-sm font-semibold">Choose your order date to continue.</p>
            <button type="button" onClick={openOrderChooser} className="focus-ring mt-3 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white">
              Choose a date
            </button>
          </div>
        )}

        {/* autoComplete + inputMode are what make this feel native: the phone field
            raises a number pad, the email field a keyboard with @, and the browser
            offers the customer's saved details rather than making them retype. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <input required autoComplete="name" placeholder="Full name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="rounded-xl border border-ink/20 px-4 py-3" />
          <input required type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" placeholder="Email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="rounded-xl border border-ink/20 px-4 py-3" />
          <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="rounded-xl border border-ink/20 px-4 py-3" />
          <input required={orderContext?.fulfillment === "delivery"} autoComplete="street-address" placeholder={orderContext?.fulfillment === "delivery" ? "Delivery address" : "Address (optional)"} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="rounded-xl border border-ink/20 px-4 py-3" />
        </div>
        <textarea placeholder="Order notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-4 min-h-24 w-full rounded-xl border border-ink/20 px-4 py-3" />
        <textarea placeholder="Delivery or pickup notes (optional)" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} className="mt-4 min-h-20 w-full rounded-xl border border-ink/20 px-4 py-3" />

        {/* Asked before the intent is created, because whether the card may be
            kept has to be decided when the payment is set up, not after. */}
        {!clientSecret && account && !savedCards.length && (
          <label className="mt-5 flex items-start gap-3 rounded-xl bg-cream/70 p-4 text-sm">
            <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
            <span>
              <b className="font-bold">Save my card for next time</b>
              <span className="mt-1 block text-xs leading-5 text-ink/60">Stored by Stripe, never by us. Next order is one tap.</span>
            </span>
          </label>
        )}
        {!clientSecret && !account && (
          <p className="mt-5 rounded-xl bg-cream/70 p-4 text-xs leading-5 text-ink/65">
            <Link href="/account/login" className="font-bold underline underline-offset-4">Sign in</Link> to save your card and reorder in one tap next time.
          </p>
        )}

        {(!clientSecret || stale) && (
          <button disabled={loading} className="focus-ring mt-6 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-50">
            {loading ? "Checking availability…" : stale ? "Update total and continue" : "Continue to secure payment"}
          </button>
        )}
        {stale && (
          <p className="mt-3 text-sm font-semibold text-clay">
            Your basket changed, so the total needs recalculating before you pay.
          </p>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">{error}</p>
            {fixWithChooser && (
              <button type="button" onClick={openOrderChooser} className="focus-ring mt-3 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white">
                Choose a new date
              </button>
            )}
          </div>
        )}
      </form>

      <aside className="rounded-3xl bg-moss p-6 text-white sm:p-8">
        <p className="text-xs font-bold tracking-widest text-honey uppercase">Order summary</p>
        <h2 className="display t-h3 mt-2 font-semibold">{orderContext?.orderWindow.name || "Choose an order date"}</h2>
        <p className="mt-2 text-sm text-white/65">{orderContext?.fulfillment === "delivery" ? `Delivery to ${orderContext.deliveryZone?.name}` : "Pickup in Beit Shemesh"}</p>
        <div className="mt-6 space-y-4">
          {cart.map((line) => (
            <div key={line.key} className="flex justify-between gap-4 border-b border-white/10 pb-4 text-sm">
              <div><b>{line.title}</b><p className="text-xs text-white/55">{line.quantity} × {line.variantLabel}</p></div>
              <b className="tabular-nums">₪{(line.quantity * line.unitPrice).toFixed(2)}</b>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-white/15 pt-4 text-sm">
          <div className="flex justify-between"><span className="text-white/70">Subtotal</span><b className="tabular-nums">₪{totals.subtotal.toFixed(2)}</b></div>
          {orderContext?.fulfillment === "delivery" && (
            <div className="mt-2 flex justify-between"><span className="text-white/70">Delivery</span><b className="tabular-nums">{totals.deliveryFee ? `₪${totals.deliveryFee.toFixed(2)}` : "Free"}</b></div>
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
            <b className="text-base">Total</b>
            <b className="display text-2xl tabular-nums">₪{totals.total.toFixed(2)}</b>
          </div>
        </div>

        <div ref={paymentRef} className="scroll-mt-24">
          {showCardEntry ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
              <Payment
                paymentIntentId={paymentIntentId}
                savedCards={savedCards}
                chosenCard={chosenCard}
                setChosenCard={setChosenCard}
                canSaveCard={Boolean(account)}
              />
            </Elements>
          ) : clientSecret && !stale ? (
            <p className="mt-6 rounded-xl bg-white/10 p-4 text-sm">Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to display secure payment.</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Payment({
  paymentIntentId,
  savedCards,
  chosenCard,
  setChosenCard,
  canSaveCard,
}: {
  paymentIntentId: string;
  savedCards: SavedCard[];
  chosenCard: string;
  setChosenCard: (id: string) => void;
  canSaveCard: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { cart, clearCart } = useStorefront();
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  // Someone with a card on file can still reach for a different one.
  const [useNewCard, setUseNewCard] = useState(!savedCards.length);

  // Captured before the cart is emptied, so the purchase event still has them.
  const cartItems = cart.map((line) => ({ id: line.productId ?? line.bundleId, title: line.title, price: line.unitPrice, quantity: line.quantity, variant: line.variantLabel }));
  const cartValue = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const finish = useCallback(async () => {
    const response = await fetch("/api/checkout/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Order processing failed.");
    // Sent before the cart is cleared, since the cart is where the items are.
    // The payment id is the transaction id: it is unique and stable, so GA4
    // de-duplicates correctly if the thank-you page is reloaded or shared. The
    // order number would read better in reports but is not returned by the
    // completion route, and threading it through the payment path for a
    // nicer label is not a trade worth making.
    trackPurchase(paymentIntentId, cartValue, cartItems);
    clearCart();
    router.push(`/thank-you?payment_intent=${encodeURIComponent(paymentIntentId)}`);
  }, [paymentIntentId, clearCart, router]);

  /** The saved-card path: confirmed on the server, so there is no card form. */
  async function payWithSaved() {
    setPaying(true); setError("");
    try {
      const response = await fetch("/api/checkout/pay-saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentIntentId, paymentMethodId: chosenCard }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That card could not be charged.");

      // An Israeli issuer can still demand 3-D Secure on a saved card. That is
      // an extra step, not a failure — the browser finishes it and we carry on.
      if (data.status === "requires_action" && data.clientSecret) {
        const result = await stripe?.handleNextAction({ clientSecret: data.clientSecret });
        if (result?.error) throw new Error(result.error.message || "Payment was not authorised.");
      }
      await finish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed.");
      setPaying(false);
    }
  }

  /** The ordinary path: card entered in Stripe's own form. */
  async function payWithNewCard() {
    if (!stripe || !elements) return;
    setPaying(true); setError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}/thank-you?payment_intent=${encodeURIComponent(paymentIntentId)}` },
      });
      if (result.error) throw new Error(result.error.message || "Payment failed.");
      await finish();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment failed.");
      setPaying(false);
    }
  }

  return (
    <div className="mt-7">
      {savedCards.length > 0 && !useNewCard ? (
        <>
          <p className="text-xs font-bold tracking-widest text-honey uppercase">Pay with</p>
          <div className="mt-3 space-y-2">
            {savedCards.map((card) => (
              <label key={card.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm ${chosenCard === card.id ? "border-honey bg-white/10" : "border-white/20"}`}>
                <input type="radio" name="saved-card" value={card.id} checked={chosenCard === card.id} onChange={() => setChosenCard(card.id)} className="size-4" />
                <span className="flex-1 font-semibold">{cardLabel(card)}</span>
                <span className="text-xs text-white/50 tabular-nums">{String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={payWithSaved} disabled={!chosenCard || paying} className="focus-ring mt-5 w-full rounded-full bg-honey px-6 py-4 text-sm font-extrabold text-ink disabled:opacity-50">
            {paying ? "Processing…" : "Place order"}
          </button>
          <button type="button" onClick={() => setUseNewCard(true)} className="focus-ring mt-3 w-full py-2 text-xs font-semibold text-white/70 underline underline-offset-4">
            Use a different card
          </button>
        </>
      ) : (
        <>
          <PaymentElement />
          {canSaveCard && savedCards.length > 0 && (
            <button type="button" onClick={() => setUseNewCard(false)} className="focus-ring mt-3 w-full py-2 text-xs font-semibold text-white/70 underline underline-offset-4">
              Use a saved card instead
            </button>
          )}
          <button type="button" onClick={payWithNewCard} disabled={!stripe || paying} className="focus-ring mt-5 w-full rounded-full bg-honey px-6 py-4 text-sm font-extrabold text-ink disabled:opacity-50">
            {paying ? "Processing…" : "Pay securely"}
          </button>
        </>
      )}
      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </div>
  );
}
