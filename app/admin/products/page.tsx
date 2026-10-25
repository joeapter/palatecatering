import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { ProductsManager } from "@/components/admin/products-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Products &amp; pricing</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Every item and every size, across all menus. Change a price and it takes effect
        immediately — confirming a price also clears its review flag. Removing a size hides
        it rather than deleting it, so past orders still make sense.
      </p>
      <div className="mt-10">
        <ProductsManager />
      </div>
    </main>
  );
}
