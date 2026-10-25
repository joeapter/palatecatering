import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { DesignManager } from "@/components/admin/design-manager";

export const dynamic = "force-dynamic";

export default async function AdminDesignPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Design &amp; content</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        The hero slides, the wording on each page, and which sections customers can see.
        Photos are chosen from the images already on the site — click <b>Change photo</b> to
        browse them.
      </p>
      <div className="mt-10">
        <DesignManager />
      </div>
    </main>
  );
}
