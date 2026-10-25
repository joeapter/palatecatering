import Link from "next/link";
import { isKitchen } from "@/lib/kitchen-session";
import { isAdmin } from "@/lib/admin-auth";
import { KitchenLogin } from "@/components/kitchen/kitchen-login";
import { RecipeBook } from "@/components/recipes/recipe-book";
import { KitchenHeader } from "@/components/kitchen/kitchen-header";
import { DesktopRequestHint } from "@/components/desktop-request-hint";

export const dynamic = "force-dynamic";

export default async function KitchenRecipesPage() {
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
        {/* Deletion stays with the admin. The kitchen can write and correct a
            recipe freely, but removing one outright is not a shift decision. */}
        <RecipeBook canDelete={false} />
      </div>
    </main>
  );
}
