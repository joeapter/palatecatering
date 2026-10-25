import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@vercel/postgres";

export const metadata: Metadata = { title: "Reminders stopped", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * One click stops the reminders, with no sign-in and no confirmation step.
 *
 * Anything more than that is a dark pattern, and a customer who cannot easily
 * stop the mail marks it as spam instead — which costs the deliverability of
 * every order confirmation the kitchen sends.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let stopped = false;

  if (/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    try {
      const result = await sql`
        UPDATE abandoned_carts
        SET unsubscribed_at = COALESCE(unsubscribed_at, now()),
            reminder_stop_reason = COALESCE(reminder_stop_reason, 'unsubscribed'),
            updated_at = now()
        WHERE recovery_token = ${token}
        RETURNING id;
      `;
      stopped = (result.rowCount ?? 0) > 0;
    } catch {
      stopped = false;
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="max-w-md rounded-[1.75rem] border border-ink/10 bg-white p-8 text-center">
        <h1 className="display t-h3 font-semibold">
          {stopped ? "Reminders stopped." : "That link has expired."}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          {stopped
            ? "We will not email you about this basket again. Order confirmations and delivery details are unaffected."
            : "We could not find that basket — it may already have been ordered or cleared."}
        </p>
        <Link href="/" className="focus-ring mt-6 inline-block rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-white">
          Back to Palate
        </Link>
      </div>
    </main>
  );
}
