"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "@/lib/hooks/use-overlay";

export type AdminNavItem = { href: string; label: string };

/**
 * Admin navigation.
 *
 * A horizontal scrolling rail replaced the wrapped desktop nav, which stopped
 * the header eating half the screen but hid most sections off the right edge —
 * you had to know they were there to go looking. A menu button shows all of
 * them at once, which is what a phone actually needs.
 *
 * Portalled to <body>: the admin header uses `backdrop-blur`, and a
 * backdrop-filter makes an element the containing block for fixed descendants,
 * which would clip this sheet to the height of the header.
 */
export function AdminNav({ items, kitchenHref }: { items: AdminNavItem[]; kitchenHref: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);

  useOverlay(open, close);
  useEffect(() => { setMounted(true); }, []);
  // Arriving on the new page with the menu still over it is disorienting.
  useEffect(() => { setOpen(false); }, [pathname]);

  const current = items.find((item) => item.href === pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
        className="focus-ring -ml-1 flex size-11 items-center justify-center rounded-full lg:hidden"
      >
        <span className="flex w-5 flex-col gap-[5px]">
          <span className="h-[2px] w-full rounded bg-ink" />
          <span className="h-[2px] w-full rounded bg-ink" />
          <span className="h-[2px] w-full rounded bg-ink" />
        </span>
      </button>

      {/* The section you are on, so the header still says where you are once
          the rail is gone. */}
      <span className="truncate text-sm font-bold lg:hidden">{current?.label ?? "Admin"}</span>

      {/* Full nav from `lg` up, where there is room for it. */}
      <nav className="hidden gap-1 text-sm font-semibold lg:flex" aria-label="Admin sections">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.href === pathname ? "page" : undefined}
            className={`rounded-full px-3 py-2 whitespace-nowrap ${item.href === pathname ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5 hover:text-ink"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {open && mounted && createPortal((
        <div className="fixed inset-0 z-[95] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-ink/50" onPointerDown={close} />
          <div className="pt-safe pb-safe absolute inset-y-0 left-0 flex w-[min(86vw,22rem)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <p className="display text-xl font-semibold">Palate admin</p>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="focus-ring flex size-11 items-center justify-center rounded-full border border-ink/15 text-xl"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Admin sections">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === pathname ? "page" : undefined}
                  className={`block rounded-xl px-4 py-3.5 text-base font-semibold ${item.href === pathname ? "bg-ink text-white" : "active:bg-ink/5"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="grid gap-2 border-t border-ink/10 px-4 py-4">
              <Link href={kitchenHref} className="focus-ring rounded-full bg-moss px-4 py-3.5 text-center text-sm font-bold text-white">
                Kitchen screen
              </Link>
              <Link href="/" className="focus-ring rounded-full border border-ink/20 px-4 py-3.5 text-center text-sm font-bold">
                View the site
              </Link>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
