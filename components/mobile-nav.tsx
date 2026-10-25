"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlay } from "@/lib/hooks/use-overlay";
import { useStorefront } from "./storefront-provider";

export type NavLink = { label: string; href: string };
export type NavGroup = { label: string; href: string; links: NavLink[] };

/**
 * The phone navigation.
 *
 * The desktop nav is `hidden lg:flex` and nothing stood in for it below
 * 1024px, so on a phone the site had no navigation at all — the only way to
 * reach a category was the homepage tiles. This is that missing nav.
 *
 * It is a sheet rather than a dropdown because the category list is long, and
 * the groups are accordions rather than links-to-a-hub so a reader can get from
 * "I want fish" to the fish page in two taps without loading an intermediate
 * page on a phone connection.
 */
export function MobileNav({
  groups,
  linksBeforeLastGroup = [],
  links,
  phone,
}: {
  groups: NavGroup[];
  linksBeforeLastGroup?: NavLink[];
  links: NavLink[];
  phone: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(groups[0]?.label ?? null);
  const pathname = usePathname();
  const { orderContext, openOrderChooser } = useStorefront();

  const close = useCallback(() => setOpen(false), []);
  useOverlay(open, close);

  useEffect(() => { setMounted(true); }, []);

  // A tap that navigates has to dismiss the sheet, or the reader arrives at the
  // new page with the menu still covering it.
  useEffect(() => { setOpen(false); }, [pathname]);

  const whatsapp = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="focus-ring -ml-2 flex size-11 items-center justify-center rounded-full lg:hidden"
      >
        <span className="flex w-5 flex-col gap-[5px]">
          <span className="h-[2px] w-full rounded bg-ink" />
          <span className="h-[2px] w-full rounded bg-ink" />
          <span className="h-[2px] w-full rounded bg-ink" />
        </span>
      </button>

      {/*
        Portalled to <body> on purpose. This component renders inside the site
        header, and the header carries `backdrop-blur` — a `backdrop-filter`
        makes an element the containing block for any `position: fixed`
        descendant, so the sheet was being clipped to the 113px header instead
        of covering the screen. Escaping the header is the fix.
      */}
      {open && mounted && createPortal((
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/50" onPointerDown={close} />
          <div className="pt-safe pb-safe absolute inset-y-0 left-0 flex w-[min(88vw,26rem)] flex-col bg-cream shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <p className="display text-2xl font-semibold">Menu</p>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="focus-ring flex size-11 items-center justify-center rounded-full border border-ink/15 text-xl"
              >
                ×
              </button>
            </div>

            {/* Ordering for which Shabbos is the thing that changes what the
                menu shows, so it sits above the links rather than buried. */}
            <button
              type="button"
              onClick={() => { close(); openOrderChooser(); }}
              className="border-b border-ink/10 bg-honey px-5 py-4 text-left"
            >
              <span className="block text-[10px] font-bold tracking-[.18em] uppercase opacity-70">
                {orderContext ? "Ordering for" : "Start here"}
              </span>
              <span className="mt-1 flex items-center justify-between gap-3 text-sm font-bold">
                {orderContext ? orderContext.orderWindow.name : "Choose your date & delivery"}
                <span aria-hidden="true">›</span>
              </span>
            </button>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-5 py-3" aria-label="Mobile navigation">
              {groups.map((group, groupIndex) => {
                const isOpen = expanded === group.label;
                return (
                  <div key={group.label}>
                  {groupIndex === groups.length - 1 && linksBeforeLastGroup.map((link) => (
                    <Link key={link.href} href={link.href} className="focus-ring block border-b border-ink/10 py-4 text-base font-bold">
                      {link.label}
                    </Link>
                  ))}
                  <div key={group.label} className="border-b border-ink/10">
                    <div className="flex items-center">
                      <Link
                        href={group.href}
                        className="focus-ring flex-1 py-4 text-base font-bold"
                      >
                        {group.label}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : group.label)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} ${group.label} categories`}
                        className="focus-ring flex size-11 items-center justify-center rounded-full text-lg"
                      >
                        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">⌄</span>
                      </button>
                    </div>
                    {isOpen && (
                      <div className="grid grid-cols-2 gap-x-3 pb-4">
                        {group.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="focus-ring rounded-xl px-3 py-3 text-sm font-semibold text-ink/75 active:bg-ink/5"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}

              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring block border-b border-ink/10 py-4 text-base font-bold"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="grid grid-cols-2 gap-3 border-t border-ink/10 px-5 py-4">
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="focus-ring rounded-full border border-ink/20 px-4 py-3 text-center text-sm font-bold">
                Call
              </a>
              <a href={whatsapp} className="focus-ring rounded-full bg-moss px-4 py-3 text-center text-sm font-bold text-white">
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
