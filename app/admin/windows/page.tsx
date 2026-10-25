import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { WindowsManager } from "@/components/admin/windows-manager";

export const dynamic = "force-dynamic";

export default async function AdminWindowsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Order windows</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        Each week customers order for is a window, with its own closing time. When a window
        closes, checkout stops accepting orders for that date automatically.
      </p>
      <div className="mt-10">
        <WindowsManager />
      </div>
    </main>
  );
}
