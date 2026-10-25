import type { MetadataRoute } from "next";

/**
 * Makes the admin installable to a phone's home screen and opens it
 * full-screen, with no browser chrome — which is what makes it feel like an app
 * rather than a bookmark.
 *
 * `start_url` is /admin because whoever installs this is the owner using it on
 * the go. A customer who somehow installs it simply lands on the sign-in page.
 * The kitchen has its own manifest at /kitchen.webmanifest so the two live as
 * separate icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Palate Admin",
    short_name: "Palate",
    description: "Orders, menu and pricing for Palate Catering.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#34483c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
