import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { CartRecoveryBoard } from "@/components/admin/cart-recovery";

export const dynamic = "force-dynamic";

export default async function AdminRecoveryPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Abandoned baskets</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Every basket that was filled but not paid for, and the reminders sent to bring it back.
        Reminders are timed against each order window&rsquo;s cutoff rather than the clock: one an
        hour after the customer leaves, one the next day if the cutoff is still more than a day
        away, and a last call on the closing day. Three at most, and they stop the moment the
        customer orders, empties the basket, unsubscribes, or the cutoff passes.
      </p>
      <div className="mt-10">
        <CartRecoveryBoard />
      </div>
    </main>
  );
}
