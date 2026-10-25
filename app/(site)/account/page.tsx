import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { getCurrentUser } from "@/lib/session";
import { ReorderButton } from "@/components/reorder-button";
import { LogoutButton } from "@/components/logout-button";
import { SavedCards } from "@/components/saved-cards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

type OrderRow = {
  id: number;
  order_number: number;
  created_at: string;
  status: string;
  total: string;
  shabbos_label: string | null;
  items: unknown;
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");

  // Matched on user_id OR email so orders placed as a guest, before the account
  // existed, still show up — that is what a customer expects to see here.
  const { rows } = await sql`
    SELECT id, order_number, created_at, status, total, shabbos_label, items
    FROM orders
    WHERE COALESCE(is_deleted, false) = false
      AND (user_id = ${user.id} OR lower(customer_email) = ${user.email.toLowerCase()})
    ORDER BY created_at DESC
    LIMIT 25;
  `;
  const orders = rows as OrderRow[];

  return (
    <main className="min-h-[70vh] px-6 py-14 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Your account</p>
            <h1 className="display mt-4 t-h1 font-semibold">
              {user.name ? `Hello, ${user.name.split(" ")[0]}.` : "Your orders."}
            </h1>
            <p className="mt-4 text-sm text-ink/55">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        <section className="mt-12">
          <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">Order history</h2>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-ink/20 bg-white/60 p-10 text-center">
              <p className="leading-7 text-ink/60">
                No orders yet. When you place one it will appear here, ready to repeat.
              </p>
              <Link
                href="/shabbos"
                className="mt-6 inline-block rounded-full bg-ink px-7 py-4 text-sm font-bold text-white"
              >
                Start an order
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {orders.map((order) => {
                const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
                return (
                  <li
                    key={order.id}
                    className="rounded-[1.5rem] border border-ink/10 bg-white p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-bold">Order #{order.order_number}</p>
                          <span className="rounded-full bg-cream px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink/50">
                          {new Date(order.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                          {order.shabbos_label ? ` · ${order.shabbos_label}` : ""}
                        </p>
                        <p className="mt-3 text-sm text-ink/65">
                          {items
                            .slice(0, 4)
                            .map((item) => `${item.quantity ?? 1}× ${item.title ?? "Item"}`)
                            .join(", ")}
                          {items.length > 4 ? ` and ${items.length - 4} more` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <p className="text-xl font-bold">₪{Number(order.total || 0).toFixed(2)}</p>
                        <ReorderButton orderId={order.id} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <SavedCards />
      </div>
    </main>
  );
}
