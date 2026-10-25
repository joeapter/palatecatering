import type { Metadata } from "next";
import { RestoreCart } from "@/components/restore-cart";

export const metadata: Metadata = { title: "Restoring your basket", robots: { index: false, follow: false } };

/**
 * Where a reminder email lands. The work is done client-side because the cart
 * lives in the browser's own storage, so the page hands the token straight to
 * the component that rebuilds it.
 */
export default async function RestoreCartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <RestoreCart token={token} />
    </main>
  );
}
