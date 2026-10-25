import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AccountForm } from "@/components/account-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to see your Palate order history and repeat a past order.",
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-xs font-bold tracking-[.25em] text-clay uppercase">Account</p>
        <h1 className="display mt-4 t-h2 font-semibold">Sign in.</h1>
        <p className="mt-4 leading-7 text-ink/60">
          Your order history in one place, so repeating last week&rsquo;s Shabbos order takes
          one tap.
        </p>
        <AccountForm />
      </div>
    </main>
  );
}
