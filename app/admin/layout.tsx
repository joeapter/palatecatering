import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { AdminSignOut } from "@/components/admin/sign-out";
import { AdminNav } from "@/components/admin/admin-nav";
import { DesktopRequestHint } from "@/components/desktop-request-hint";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products & pricing" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/pricing", label: "Price review" },
  { href: "/admin/recipes", label: "Recipes" },
  { href: "/admin/windows", label: "Order windows" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/cook-list", label: "Cook planner" },
  { href: "/admin/orders/new", label: "New order" },
  { href: "/admin/recovery", label: "Abandoned baskets" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/design", label: "Design & content" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Not a gate — each page authorises itself. This only decides whether the
  // chrome is shown, so the sign-in page renders bare.
  const authed = await isAdmin();

  if (!authed) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-[#eef0eb]">
      <DesktopRequestHint />
      {/*
        Sticky and padded for the notch, because this is installed to a home
        screen and runs full-bleed with no browser chrome above it. On a phone
        the sections live behind a menu button; from `lg` up they sit inline.
      */}
      <header className="pt-safe sticky top-0 z-40 border-b border-ink/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:px-6 sm:py-3">
          <AdminNav items={NAV} kitchenHref="/kitchen" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link href="/kitchen" className="hidden rounded-full border border-ink/20 px-3 py-2 text-xs font-bold lg:inline-block">
              Kitchen
            </Link>
            <Link href="/" className="hidden text-sm text-ink/60 underline lg:inline">
              View site
            </Link>
            <AdminSignOut />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
