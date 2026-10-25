import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant", weight: ["500", "600", "700"] });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

/**
 * The shell only: document, fonts, and the defaults every route inherits.
 *
 * The storefront's header, footer, cart and structured data moved down into
 * `(site)`, because they were being rendered on the admin and kitchen screens
 * too — an announcement bar, a shop logo and a cart button sat above the admin,
 * eating the top of the screen on a phone and looking absurd on a tool that is
 * installed as its own app. A route group keeps the URLs exactly as they were.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://www.palatecateringisrael.com"),
  title: { default: "Palate | Kosher Shabbos Food in Beit Shemesh", template: "%s | Palate" },
  description: "Order thoughtfully prepared kosher food for Shabbos and Yom Tov from Palate in Beit Shemesh.",
  openGraph: { type: "website", siteName: "Palate", images: ["/assets/og-image.jpg"] },
  applicationName: "Palate",
  manifest: "/manifest.webmanifest",
  // Home-screen install on iOS: open full-screen and label the icon "Palate".
  // Android reads the same intent from the manifest.
  appleWebApp: { capable: true, title: "Palate", statusBarStyle: "default" },
};

/**
 * Deliberately the plainest possible viewport.
 *
 * `viewportFit: "cover"` was here so the page could paint into the notch and
 * home-indicator areas. Installed to an iPhone home screen it came out with a
 * desktop-width layout scaled down, while a second Next.js app on the same
 * phone — same framework, same install method, but no `viewport-fit` and no
 * manifest `orientation` — installed correctly. Matching that known-good
 * configuration is worth more than painting under the notch.
 *
 * `env(safe-area-inset-*)` resolves to 0 without `cover`, so the `pt-safe` and
 * `pb-safe` helpers simply become no-ops rather than breaking.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#34483c",
};

// trim(): an env var shipped with a trailing newline once produced an
// unterminated string in the inline script below and killed analytics sitewide
// on another site of ours. Same guard here.
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        {children}

        {/*
          Native script tags rendered server-side, not next/script or
          @next/third-parties: client-side script injection throws
          "Invalid or unexpected token" on a sister site of ours and GA4
          silently collected nothing. Parse-time execution has no injection
          step and cannot fail that way.

          /admin, /kitchen and /account are excluded through
          window['ga-disable-<id>'], gtag's own documented kill switch, which
          is checked per hit. A one-off check at load is not enough: gtag's
          enhanced measurement fires page_view on client-side navigations, so a
          session that lands on the shop and then opens the admin would leak
          staff activity into the customer numbers. The flag is re-synced by
          wrapping pushState and replaceState — this runs before the async
          gtag.js, so gtag's own history wrapper wraps ours and the flag is
          already correct by the time it reads it.

          Nothing renders at all until NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so
          this is inert until you choose to turn it on.
        */}
        {gaMeasurementId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `(function(){var d='ga-disable-${gaMeasurementId}';function sync(){window[d]=/^\\/(admin|kitchen|account)(\\/|$)/.test(location.pathname);}sync();var ps=history.pushState;history.pushState=function(){var r=ps.apply(this,arguments);sync();return r;};var rs=history.replaceState;history.replaceState=function(){var r=rs.apply(this,arguments);sync();return r;};addEventListener('popstate',sync);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaMeasurementId}');})();`,
              }}
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
