import Image from "next/image";
import Link from "next/link";
import { StorefrontActions } from "./storefront-actions";
import { MobileNav, type NavGroup, type NavLink } from "./mobile-nav";
import { EVENT_TYPES } from "@/lib/content/events";
import { getFeatureFlags, getSiteContent, text } from "@/lib/site-settings";

const shabbosCategories = ["Salatim", "Fish", "Soups", "Appetizers", "Chicken", "Meat", "Sides", "Salads"];

/**
 * Mega-menus open on hover and close when the pointer leaves. They are
 * deliberately not driven by focus state — a menu that stays open because
 * something inside it is still focused was a reported annoyance.
 */
function MegaMenu({
  label,
  href,
  title,
  links,
  image,
  imageAlt,
}: {
  label: string;
  href: string;
  title: string;
  links: { label: string; href: string }[];
  image: string;
  imageAlt: string;
}) {
  return (
    <div className="group flex h-full items-center">
      <Link href={href} className="focus-ring transition hover:text-clay">
        {label} <span aria-hidden="true">⌄</span>
      </Link>
      <div className="invisible absolute inset-x-0 top-full border-y border-ink/10 bg-cream opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
        <div className="mx-auto grid max-w-7xl grid-cols-[.9fr_1.1fr] gap-12 px-10 py-10">
          <div>
            <p className="display t-h3 font-semibold">{title}</p>
            <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-b border-ink/10 py-2 transition hover:translate-x-1 hover:text-clay"
                >
                  {link.label} <span className="float-right">›</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="relative min-h-64 overflow-hidden rounded-[2rem]">
            <Image src={image} alt={imageAlt} fill className="object-cover" sizes="50vw" />
          </div>
        </div>
      </div>
    </div>
  );
}

export async function SiteHeader() {
  const [flags, content] = await Promise.all([getFeatureFlags(), getSiteContent()]);
  const phone = text(content, "site.phone", "058-728-0062");

  // The same structure the desktop mega-menus use, handed to the phone sheet so
  // the two navigations can never drift apart.
  const groups: NavGroup[] = [
    {
      label: "Shabbos & Yom Tov",
      href: "/shabbos",
      links: shabbosCategories.map((label) => ({ label, href: `/shabbos/${label.toLowerCase()}` })),
    },
    {
      label: "Event catering",
      href: "/catering",
      links: EVENT_TYPES.map((event) => ({ label: event.menuLabel, href: `/catering/${event.slug}` })),
    },
  ];
  const flatLinks: NavLink[] = [
    { label: "Guides", href: "/guides" },
    { label: "Kashrus", href: "/kashrus" },
    { label: "My account", href: "/account" },
  ];
  const commerceLinks: NavLink[] = [
    ...(flags.packagesEnabled ? [{ label: "Packages", href: "/packages" }] : []),
    ...(flags.holidaysEnabled ? [{ label: "Holidays", href: "/holidays" }] : []),
    { label: "Dairy", href: "/dairy" },
  ];

  // Only the navigation row is sticky. When the whole header stuck, the
  // announcement wrapped to two lines on a phone and the pair held ~115px —
  // a sixth of the screen — for the entire scroll. The announcement now
  // scrolls away and the bar that stays is a single 64px row.
  return (
    <header>
      <div className="bg-moss px-5 py-2 text-center text-[11px] font-semibold tracking-[.14em] text-white uppercase sm:tracking-[.18em]">
        {text(content, "home.announcement", "Pickup in Beit Shemesh · Delivery across Jerusalem and surrounding areas")}
      </div>
      <div className="sticky top-0 z-50 border-b border-ink/10 bg-cream/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:h-20 sm:px-5 lg:px-10">
        <MobileNav groups={groups} linksBeforeLastGroup={commerceLinks} links={flatLinks} phone={phone} />

        <Link href="/" className="focus-ring flex shrink-0 items-center gap-3 max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2" aria-label="Palate home">
          {/* The wordmark, not the cutting board. It reads as a name at a
              glance where the board read as a picture, so it carries more of
              the header and is set larger than the board ever was. */}
          <Image src="/assets/logo-wordmark.png" alt="" width={240} height={80} className="h-12 w-auto object-contain sm:h-14" priority />
        </Link>

        <nav className="hidden h-full items-center gap-8 text-sm font-semibold lg:flex" aria-label="Main navigation">
          <MegaMenu
            label="Shabbos & Yom Tov"
            href="/shabbos"
            title="Shabbos & Yom Tov"
            links={shabbosCategories.map((label) => ({ label, href: `/shabbos/${label.toLowerCase()}` }))}
            image="/assets/gallery/gallery1.jpg"
            imageAlt="Palate composed salad"
          />
          {flags.packagesEnabled && (
            <Link href="/packages" className="focus-ring transition hover:text-clay">Packages</Link>
          )}
          {flags.holidaysEnabled && (
            <Link href="/holidays" className="focus-ring transition hover:text-clay">Holidays</Link>
          )}
          <Link href="/dairy" className="focus-ring transition hover:text-clay">Dairy</Link>
          <MegaMenu
            label="Event catering"
            href="/catering"
            title="Simchas & events"
            links={EVENT_TYPES.map((event) => ({
              label: event.menuLabel,
              href: `/catering/${event.slug}`,
            }))}
            image="/assets/gallery/gallery3.jpg"
            imageAlt="A Palate event table"
          />
          <Link href="/guides" className="focus-ring transition hover:text-clay">Guides</Link>
          <Link href="/kashrus" className="focus-ring transition hover:text-clay">Kashrus</Link>
        </nav>

        {/* WhatsApp lives in the phone nav sheet instead, so the mobile bar
            keeps to three targets: menu, logo, cart. */}
        <div className="flex items-center gap-3">
          <a href="https://wa.me/972587280062" className="focus-ring hidden rounded-full border border-ink/20 px-4 py-2 text-xs font-bold lg:block">WhatsApp</a>
          <StorefrontActions />
        </div>
      </div>
      </div>
    </header>
  );
}
