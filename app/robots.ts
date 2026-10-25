import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing here is secret, but these pages are per-customer or
        // operational and have no business in an index.
        disallow: ["/admin", "/admin/", "/account", "/account/", "/checkout", "/thank-you", "/api/"],
      },
    ],
    sitemap: "https://www.palatecateringisrael.com/sitemap.xml",
  };
}
