import type { MetadataRoute } from "next";
import { getShabbosCatalog } from "@/lib/storefront/catalog";
import { getBundles } from "@/lib/storefront/bundles";
import { GUIDES } from "@/lib/content/guides";
import { EVENT_TYPES } from "@/lib/content/events";

const BASE = "https://www.palatecateringisrael.com";

export const revalidate = 3600;

/**
 * Generated from the catalog rather than hand-maintained, so a new category or
 * package is submitted to search engines the moment it goes live. The old
 * static sitemap.xml at the repo root was not even reachable — it was never
 * symlinked into public/ — so nothing was being submitted at all.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/shabbos`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/packages`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/holidays`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/holidays/sukkos`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    // Out of season, kept in the map so the URL keeps its standing for next year.
    { url: `${BASE}/holidays/rosh-hashanah`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/dairy`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/catering`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/kashrus`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    // High priority: "do you deliver to X" is one of the most common questions
    // asked of the business and of any assistant answering on its behalf.
    { url: `${BASE}/delivery`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  const [catalog, bundles] = await Promise.all([
    getShabbosCatalog().catch(() => []),
    getBundles().catch(() => []),
  ]);

  return [
    ...staticRoutes,
    ...catalog.map((category) => ({
      url: `${BASE}/shabbos/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...bundles.map((bundle) => ({
      url: `${BASE}/packages/${bundle.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...EVENT_TYPES.map((event) => ({
      url: `${BASE}/catering/${event.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...GUIDES.map((guide) => ({
      url: `${BASE}/guides/${guide.slug}`,
      lastModified: new Date(guide.updated),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
