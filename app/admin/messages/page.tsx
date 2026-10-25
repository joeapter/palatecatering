import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { MessageComposer } from "@/components/admin/message-composer";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Messages</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        The wording of every message sent to a customer, from the order rows, the customers list
        and the kitchen screen. Edits apply everywhere immediately. The words in curly brackets
        are filled in per customer — tap one to add it.
      </p>
      <div className="mt-8">
        <MessageComposer />
      </div>
    </main>
  );
}
