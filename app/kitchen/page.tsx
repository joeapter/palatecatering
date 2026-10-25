import { isKitchen } from "@/lib/kitchen-session";
import { isAdmin } from "@/lib/admin-auth";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { KitchenLogin } from "@/components/kitchen/kitchen-login";
import { KitchenHeader } from "@/components/kitchen/kitchen-header";
import { DesktopRequestHint } from "@/components/desktop-request-hint";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  // An admin already signed in should not have to sign in twice to look at the
  // same orders.
  const [kitchen, admin] = await Promise.all([isKitchen(), isAdmin()]);

  if (!kitchen && !admin) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream px-5 py-12">
        <KitchenLogin />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream">
      <DesktopRequestHint />
      <KitchenHeader isAdminSession={admin && !kitchen} />

      <div className="mx-auto max-w-3xl px-4 py-4">
        <KitchenBoard />
      </div>
    </main>
  );
}
