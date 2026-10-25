import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { readdir } from "fs/promises";
import path from "path";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Design & content: hero slides, editable page copy, feature flags, and the
 * list of images already in the repository so a photo can be chosen rather than
 * typed as a path.
 */

const IMAGE_DIRS = ["assets/gallery", "assets/Shabbos", "assets/bris", "assets/Kashrus", "assets/generated"];
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

async function listImages(): Promise<string[]> {
  const root = process.cwd();
  const found: string[] = [];
  for (const dir of IMAGE_DIRS) {
    try {
      const entries = await readdir(path.join(root, dir));
      for (const entry of entries) {
        if (IMAGE_EXT.test(entry)) found.push(`/${dir}/${entry}`);
      }
    } catch {
      // Directory may not exist in every checkout; skip it.
    }
  }
  return found.sort();
}

const FLAGS = ["packages_enabled", "holidays_enabled"];

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [slides, content, settings, images] = await Promise.all([
      sql`SELECT id, eyebrow, headline, body, image_url, cta_label, cta_href, active, sort_order
          FROM hero_slides ORDER BY sort_order, id;`,
      sql`SELECT key, page, label, help, type, value, sort_order
          FROM site_content ORDER BY page, sort_order, key;`,
      // Positional parameters because an array is not valid in the tagged form.
      sql.query("SELECT key, value FROM site_settings WHERE key = ANY($1::text[])", [FLAGS]),
      listImages(),
    ]);

    const flags: Record<string, boolean> = {};
    for (const flag of FLAGS) flags[flag] = true;
    for (const row of settings.rows) flags[row.key] = row.value !== "false";

    return NextResponse.json({
      slides: slides.rows,
      content: content.rows,
      flags,
      images,
    });
  } catch (error) {
    console.error("Admin design load error", error);
    return NextResponse.json({ error: "Unable to load design settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "setFlag") {
      const key = String(body.key || "");
      if (!FLAGS.includes(key)) return NextResponse.json({ error: "Unknown setting." }, { status: 400 });
      const value = body.value ? "true" : "false";
      await sql`
        INSERT INTO site_settings (key, value, updated_at) VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "saveContent") {
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (!entries.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
      for (const entry of entries) {
        await sql`
          UPDATE site_content SET value = ${String(entry.value ?? "")}, updated_at = now()
          WHERE key = ${String(entry.key)};
        `;
      }
      return NextResponse.json({ ok: true, saved: entries.length });
    }

    if (action === "saveSlide") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await sql`
        UPDATE hero_slides SET
          eyebrow = COALESCE(${body.eyebrow ?? null}, eyebrow),
          headline = COALESCE(${body.headline ?? null}, headline),
          body = COALESCE(${body.body ?? null}, body),
          image_url = COALESCE(${body.imageUrl ?? null}, image_url),
          cta_label = COALESCE(${body.ctaLabel ?? null}, cta_label),
          cta_href = COALESCE(${body.ctaHref ?? null}, cta_href),
          active = COALESCE(${body.active ?? null}, active),
          sort_order = COALESCE(${body.sortOrder === undefined ? null : Number(body.sortOrder)}, sort_order),
          updated_at = now()
        WHERE id = ${id};
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "createSlide") {
      await sql`
        INSERT INTO hero_slides (eyebrow, headline, body, image_url, cta_label, cta_href, active, sort_order)
        VALUES ('New slide', ${String(body.headline || "Headline")}, '', '', 'Order now', '/shabbos', false,
                COALESCE((SELECT MAX(sort_order) + 1 FROM hero_slides), 1));
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "deleteSlide") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await sql`DELETE FROM hero_slides WHERE id = ${id};`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin design save error", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
