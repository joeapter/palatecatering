import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { PackageBuilder } from "@/components/admin/package-builder";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Packages</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Build a package for a specific week and set how many you intend to make, so the
        kitchen can cook one thing in volume. The price always follows the contents — add or
        remove a dish and it updates itself.
      </p>
      <div className="mt-10">
        <PackageBuilder />
      </div>
    </main>
  );
}
