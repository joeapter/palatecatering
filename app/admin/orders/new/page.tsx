import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { ManualOrder } from "@/components/admin/manual-order";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  // `event_type` is the menu tag the kitchen cooks that week, so picking the
  // date can pick the menu the dishes are chosen from.
  let windows: { id: number; name: string; eventType: string | null }[] = [];
  try {
    const { rows } = await sql`
      SELECT id, name, event_type FROM order_windows
      WHERE active = true AND cutoff_at > now() - interval '7 days'
      ORDER BY event_date ASC LIMIT 12;
    `;
    windows = rows.map((row) => ({ id: row.id, name: row.name, eventType: row.event_type ?? null }));
  } catch {
    windows = [];
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">New order</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        For orders taken over the phone, at the door, or quoted for a simcha. Prices come from
        the menu, so a manual order is charged the same as one placed online. Record how it was
        paid and you can print a receipt; leave it unpaid and you can send a payment link instead.
      </p>
      <div className="mt-8">
        <ManualOrder windows={windows} />
      </div>
    </main>
  );
}
