import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { Broadcast } from "@/components/admin/broadcast";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  let windows: { id: number; name: string }[] = [];
  try {
    const { rows } = await sql`
      SELECT id, name FROM order_windows
      WHERE active = true ORDER BY event_date ASC LIMIT 12;
    `;
    windows = rows as { id: number; name: string }[];
  } catch {
    windows = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Customers</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Everyone who has ordered. Pick a week to see who has not ordered yet — those are the
        people a cutoff reminder is for. WhatsApp opens with the message written; email goes
        out individually.
      </p>
      <div className="mt-10">
        <Broadcast windows={windows} />
      </div>
    </main>
  );
}
