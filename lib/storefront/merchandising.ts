import { sql } from "@vercel/postgres";
import type { StorefrontProduct } from "./types";
import { getShabbosCatalog } from "./catalog";

export type HeroSlide = { id: number | string; eyebrow: string; headline: string; body: string; imageUrl: string; ctaLabel: string; ctaHref: string };

export async function getHeroSlides(): Promise<HeroSlide[]> {
  try { const { rows } = await sql`SELECT id, eyebrow, headline, body, image_url, cta_label, cta_href FROM hero_slides WHERE active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) ORDER BY sort_order, id`; if (rows.length) return rows.map((row) => ({ id: row.id, eyebrow: row.eyebrow || "", headline: row.headline, body: row.body || "", imageUrl: row.image_url, ctaLabel: row.cta_label, ctaHref: row.cta_href })); } catch {}
  return [{ id: "default", eyebrow: "This week at Palate", headline: "Good food. Friday handled.", body: "Choose the dishes your table loves. We prepare them with care in Beit Shemesh, ready for pickup or delivery.", imageUrl: "/assets/gallery/gallery1.jpg", ctaLabel: "Explore this week’s menu", ctaHref: "/shabbos" }];
}

export async function getWeeklyRecommendations(): Promise<StorefrontProduct[]> {
  const products = (await getShabbosCatalog()).flatMap((category) => category.products);
  const curated = products.filter((product) => product.badge?.toLowerCase() === "recommended");
  return (curated.length ? curated : products.filter((product) => product.image)).slice(0, 4);
}
