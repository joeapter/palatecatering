import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef0eb] px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Palate</p>
        <h1 className="display t-h3 mt-3 font-semibold">Admin sign in</h1>
        <AdminLoginForm />
      </div>
    </main>
  );
}
