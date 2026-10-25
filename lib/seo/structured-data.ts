/**
 * JSON-LD builders.
 *
 * Beyond classic rich results, this is what lets an answer engine quote Palate
 * when someone asks "kosher Shabbos food delivery in Beit Shemesh" — the facts
 * have to be machine-readable and consistent across every page.
 */

const BASE = "https://www.palatecateringisrael.com";

export const ORGANIZATION_ID = `${BASE}/#business`;

export function foodEstablishment() {
  return {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "@id": ORGANIZATION_ID,
    name: "Palate Catering",
    url: BASE,
    logo: `${BASE}/assets/logo.png`,
    image: `${BASE}/assets/og-image.jpg`,
    telephone: "+972-58-728-0062",
    servesCuisine: ["Kosher", "Jewish", "Middle Eastern"],
    priceRange: "₪₪",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Beit Shemesh",
      addressCountry: "IL",
    },
    areaServed: [
      "Beit Shemesh",
      "Ramat Beit Shemesh",
      "Jerusalem",
      "Modiin",
      "Mevaseret Zion",
      "Telzstone",
      "Beitar Illit",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Shabbos and Yom Tov menu",
      url: `${BASE}/shabbos`,
    },
  };
}

export function breadcrumbs(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${BASE}${crumb.path}`,
    })),
  };
}

export function categoryItemList({
  name,
  slug,
  products,
}: {
  name: string;
  slug: string;
  products: Array<{ title: string; description?: string; price: number; image?: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${name} — Palate`,
    url: `${BASE}/shabbos/${slug}`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: product.title,
        description: product.description || undefined,
        image: product.image ? `${BASE}${product.image}` : undefined,
        brand: { "@type": "Brand", name: "Palate Catering" },
        offers: {
          "@type": "Offer",
          price: product.price.toFixed(2),
          priceCurrency: "ILS",
          availability: "https://schema.org/InStock",
          seller: { "@id": ORGANIZATION_ID },
        },
      },
    })),
  };
}

export function productOffer({
  name,
  description,
  image,
  price,
  path,
}: {
  name: string;
  description?: string;
  image?: string;
  price: number;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description || undefined,
    image: image ? `${BASE}${image}` : undefined,
    url: `${BASE}${path}`,
    brand: { "@type": "Brand", name: "Palate Catering" },
    offers: {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
      url: `${BASE}${path}`,
      seller: { "@id": ORGANIZATION_ID },
    },
  };
}

export function faqPage(entries: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

export function article({
  headline,
  description,
  slug,
  updated,
}: {
  headline: string;
  description: string;
  slug: string;
  updated: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url: `${BASE}/guides/${slug}`,
    dateModified: updated,
    author: { "@type": "Organization", name: "Palate Catering", "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
  };
}
