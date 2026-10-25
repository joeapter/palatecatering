import Link from "next/link";
import { CheckoutFinalizer } from "@/components/checkout-finalizer";

export const dynamic = "force-dynamic";

/**
 * Stripe appends payment_intent to the return_url when a payment needs the
 * customer to authenticate elsewhere (3-D Secure). When that happens the
 * checkout form is gone, so the finalizer below is what turns the payment into
 * an order from the browser side. The webhook covers the case where the
 * customer never comes back at all.
 */
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { payment_intent: paymentIntent } = await searchParams;

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-14 sm:py-20">
      <div className="max-w-2xl text-center">
        <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Order received</p>
        <h1 className="display mt-4 t-h1 font-semibold">Thank you.</h1>
        <p className="mt-5 leading-8 text-ink/65">
          Your payment was completed and your order was sent to the Palate kitchen. A
          confirmation will arrive by email.
        </p>
        {paymentIntent ? <CheckoutFinalizer paymentIntentId={paymentIntent} /> : null}
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-ink px-7 py-4 text-sm font-bold text-white"
        >
          Back to Palate
        </Link>
      </div>
    </main>
  );
}
