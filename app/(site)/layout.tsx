import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MobileOrderBar } from "@/components/mobile-order-bar";
import { CartRecovery } from "@/components/cart-recovery";
import { StorefrontProvider } from "@/components/storefront-provider";
import { JsonLd } from "@/components/json-ld";
import { foodEstablishment } from "@/lib/seo/structured-data";

/**
 * Everything a customer sees. `(site)` is a route group, so it adds nothing to
 * any URL — `/shabbos/salatim` is still `/shabbos/salatim`.
 *
 * The point of the grouping is what it excludes: the admin and the kitchen are
 * outside it and so render without the shop's header, footer, cart drawer and
 * business schema, none of which belong on an internal tool.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Stated once, across the storefront, so every page carries the same
          business facts — and not on admin pages, which are noindex anyway. */}
      <JsonLd data={foodEstablishment()} />
      <StorefrontProvider>
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileOrderBar />
        <CartRecovery />
      </StorefrontProvider>
    </>
  );
}
