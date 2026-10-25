import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { PricingQueue } from "@/components/admin/pricing-queue";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Price review</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        When a price is generated rather than set by you — a new seasonal item, or a size
        worked out from a base price — it lands here and the item stays hidden from
        customers until you confirm what it costs.
      </p>
      <div className="mt-10">
        <PricingQueue />
      </div>
    </main>
  );
}
