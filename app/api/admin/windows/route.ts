import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`
      SELECT ow.id, ow.name, ow.slug, ow.event_date::text AS event_date, ow.cutoff_at, ow.opens_at, ow.active,
             (SELECT count(*)::int FROM orders o
               WHERE o.order_window_id = ow.id AND COALESCE(o.is_deleted,false) = false) AS order_count
      FROM order_windows ow
      ORDER BY ow.event_date DESC
      LIMIT 40;
    `;
    return NextResponse.json({ windows: rows });
  } catch (error) {
    console.error("Windows list error", error);
    return NextResponse.json({ error: "Unable to load order windows." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();

    if (body.action === "create") {
      const name = String(body.name || "").trim();
      const eventDate = String(body.eventDate || "");
      const cutoffAt = String(body.cutoffAt || "");
      if (!name || !eventDate || !cutoffAt) {
        return NextResponse.json({ error: "Name, date and cutoff are all required." }, { status: 400 });
      }
      if (new Date(cutoffAt) >= new Date(`${eventDate}T23:59:59`)) {
        return NextResponse.json({ error: "The cutoff must be before the event date." }, { status: 400 });
      }
      const base = slugify(name) || `window-${Date.now()}`;
      const { rows: clash } = await sql`SELECT 1 FROM order_windows WHERE slug = ${base} LIMIT 1;`;
      const slug = clash.length ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
      await sql`
        INSERT INTO order_windows (name, slug, event_type, event_date, cutoff_at, opens_at, active)
        VALUES (${name}, ${slug}, ${String(body.eventType || "shabbos")}, ${eventDate},
                ${cutoffAt}, ${body.opensAt ? String(body.opensAt) : null}, true);
      `;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await sql`
        UPDATE order_windows SET
          name = COALESCE(${body.name ?? null}, name),
          cutoff_at = COALESCE(${body.cutoffAt ?? null}, cutoff_at),
          active = COALESCE(${body.active ?? null}, active)
        WHERE id = ${id};
      `;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      // A window with orders against it is closed, never deleted — those orders
      // reference it and the kitchen still needs the date.
      const { rows } = await sql`
        SELECT count(*)::int AS n FROM orders WHERE order_window_id = ${id};
      `;
      if (Number(rows[0]?.n) > 0) {
        await sql`UPDATE order_windows SET active = false WHERE id = ${id};`;
        return NextResponse.json({ ok: true, closed: true });
      }
      await sql`DELETE FROM order_windows WHERE id = ${id};`;
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Windows update error", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
