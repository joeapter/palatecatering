import Image from "next/image";
import Link from "next/link";
import { getFeatureFlags } from "@/lib/site-settings";

export async function SiteFooter() {
  // Packages and holidays can be switched off in the admin, at which point
  // their pages 404 — so the footer must not keep advertising them.
  const flags = await getFeatureFlags();
  return (
    <footer className="bg-ink px-6 py-14 text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        {/* The wordmark sits on the board rather than beside it: against the
            dark footer the board is already a white plate, so the name is
            engraved on it the way it would be on the real thing. The overlay
            is placed in percentages measured off the board's own face — the
            flat area right of the handle — so it stays put at any width. */}
        <div><div className="relative w-65 sm:w-80"><Image src="/assets/logo.png" alt="" width={320} height={213} className="w-full brightness-0 invert" /><div className="absolute top-[29.65%] left-[36.1%] h-[40%] w-[44%]"><Image src="/assets/logo-wordmark.png" alt="Palate Catering" fill className="object-contain" sizes="(min-width: 640px) 141px, 114px" /></div></div><p className="mt-5 max-w-sm text-sm leading-7 text-cream/65">Delicious Mehadrin food, prepared with care for Shabbos tables, Yom Tov, and simchas.</p></div>
        <div><p className="text-xs font-bold tracking-[.22em] uppercase text-honey">Order</p><div className="mt-3 flex flex-col text-sm *:py-2.5"><Link href="/shabbos">Shabbos menu</Link>{flags.packagesEnabled && <Link href="/packages">Complete packages</Link>}{flags.holidaysEnabled && <Link href="/holidays">Holiday menus</Link>}<Link href="/dairy">Dairy menu</Link><Link href="/catering">Event catering</Link><Link href="/delivery">Delivery areas</Link></div></div>
        <div><p className="text-xs font-bold tracking-[.22em] uppercase text-honey">Palate</p><div className="mt-3 flex flex-col text-sm *:py-2.5"><a href="tel:+972587280062">058-728-0062</a><Link href="/kashrus">Kashrus & certificates</Link><a href="https://wa.me/972587280062">Chat on WhatsApp</a></div></div>
      </div>
    </footer>
  );
}
