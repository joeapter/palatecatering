import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { OrdersBoard } from "@/components/admin/orders-board";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display t-h2 font-semibold">Orders</h1>
        <Link href="/admin/orders/new" className="focus-ring rounded-full bg-ink px-5 py-3 text-xs font-bold text-white">
          Take an order
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Pick a week to see just that window. Kitchen totals add up every dish across all its
        orders, so you know how much of each thing to cook.
      </p>
      <div className="mt-10">
        <OrdersBoard />
      </div>
    </main>
  );
}
