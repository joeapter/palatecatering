"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "@/lib/hooks/use-overlay";

const KITCHEN_PAGES = [
  { href: "/kitchen", label: "Orders", hint: "What still needs making" },
  { href: "/kitchen/cook-list", label: "Cook planner", hint: "Assign every item to a day" },
  { href: "/kitchen/recipes", label: "Recipes", hint: "How each dish is made" },
];

/**
 * The kitchen's header, matching the admin's.
 *
 * It was a single tight row, which sat awkwardly high on an installed app and
 * gave no way to reach the other kitchen pages — Recipes was a link on one
 * screen and absent from the other. A menu button and a taller bar fix both:
 * the pages are listed in one place, and the bar leaves room below the phone's
 * status area instead of butting up against it.
 */
export function KitchenHeader({ isAdminSession }: { isAdminSession: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);

  useOverlay(open, close);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const current = KITCHEN_PAGES.find((page) => page.href === pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open kitchen menu"
          aria-expanded={open}
          className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <span className="flex w-5 flex-col gap-[5px]">
            <span className="h-[2px] w-full rounded bg-ink" />
            <span className="h-[2px] w-full rounded bg-ink" />
            <span className="h-[2px] w-full rounded bg-ink" />
          </span>
        </button>

        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[.2em] text-clay uppercase">Palate kitchen</p>
          <h1 className="display truncate text-xl leading-tight font-semibold">{current?.label ?? "Kitchen"}</h1>
        </div>

        <div className="ml-auto shrink-0">
          {isAdminSession ? (
            <Link href="/admin" className="focus-ring rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold">
              Admin
            </Link>
          ) : (
            <button
              onClick={async () => {
                if (!window.confirm("Sign this device out of the kitchen?")) return;
                await fetch("/api/kitchen-auth/logout", { method: "POST" });
                router.refresh();
              }}
              className="focus-ring rounded-full border border-ink/20 px-4 py-2.5 text-xs font-bold"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {open && mounted && createPortal((
        <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Kitchen menu">
          <div className="absolute inset-0 bg-ink/50" onPointerDown={close} />
          <div className="absolute inset-y-0 left-0 flex w-[min(86vw,22rem)] flex-col bg-cream shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <p className="display text-xl font-semibold">Kitchen</p>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="focus-ring flex size-11 items-center justify-center rounded-full border border-ink/15 text-xl"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Kitchen pages">
              {KITCHEN_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  aria-current={page.href === pathname ? "page" : undefined}
                  className={`block rounded-xl px-4 py-3.5 ${page.href === pathname ? "bg-ink text-white" : "active:bg-ink/5"}`}
                >
                  <span className="block text-base font-semibold">{page.label}</span>
                  <span className={`mt-0.5 block text-xs ${page.href === pathname ? "text-white/70" : "text-ink/55"}`}>{page.hint}</span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-ink/10 px-4 py-4">
              <a href="https://wa.me/972587280062" className="focus-ring block rounded-full bg-moss px-4 py-3.5 text-center text-sm font-bold text-white">
                Message the office
              </a>
            </div>
          </div>
        </div>
      ), document.body)}
    </header>
  );
}
