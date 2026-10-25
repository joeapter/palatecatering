import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
export const metadata: Metadata = { title: "Checkout", description: "Complete your Palate order securely." };
export default function CheckoutPage() { return <main className="px-6 py-16 lg:px-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Secure checkout</p><h1 className="display mt-3 t-h1 font-semibold">Finish your order.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink/60">Availability, prices, delivery charges and the ordering cutoff are checked on the server before payment.</p><div className="mt-10"><CheckoutForm /></div></div></main>; }
