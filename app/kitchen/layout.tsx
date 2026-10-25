import type { Metadata, Viewport } from "next";

/**
 * The kitchen screen is its own installable app.
 *
 * Its own manifest, not the admin's, so the two sit on the home screen as
 * separate icons with separate names and each opens on its own screen. A
 * kitchen tablet should land in the kitchen, not on a revenue dashboard.
 */
export const metadata: Metadata = {
  title: "Kitchen",
  applicationName: "Palate Kitchen",
  manifest: "/kitchen.webmanifest",
  appleWebApp: { capable: true, title: "Palate Kitchen", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

// Matches the root viewport; see the note there on why `viewport-fit` is off.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#34483c",
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
