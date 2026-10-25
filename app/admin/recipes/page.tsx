import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { RecipeBook } from "@/components/recipes/recipe-book";

export const dynamic = "force-dynamic";

export default async function AdminRecipesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">Recipes</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-ink/60 sm:mt-3 sm:text-sm sm:leading-6">
        How each dish is made, written once and scaled on the day. The kitchen can read and
        edit these too, so whoever cooks a dish can correct it without going through the office.
        A dish can only be added while it has no recipe yet.
      </p>
      <div className="mt-8">
        <RecipeBook canDelete />
      </div>
    </main>
  );
}
