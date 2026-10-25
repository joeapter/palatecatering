import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { isKitchenRequest } from "@/lib/kitchen-session";
import { DEFAULT_TEMPLATES, type StoredTemplate } from "@/lib/notifications/templates";

/**
 * The customer message templates.
 *
 * Readable by the kitchen as well as the admin, because the kitchen sends
 * these messages and must use the same wording. Writable by the admin only —
 * the words the business says to its customers are the owner's to set.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request) && !isKitchenRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Start from the shipped defaults and let stored rows override them. A key
  // that has never been saved still comes back with working wording.
  const merged = new Map<string, StoredTemplate>(
    DEFAULT_TEMPLATES.map((t) => [t.key, { key: t.key, label: t.label, body: t.body, enabled: true }]),
  );

  try {
    const { rows } = await sql`SELECT key, label, body, enabled FROM message_templates;`;
    for (const row of rows) {
      merged.set(String(row.key), {
        key: String(row.key),
        label: String(row.label),
        body: String(row.body),
        enabled: row.enabled !== false,
      });
    }
  } catch (error) {
    // Defaults already populated; a message going out in the shipped wording is
    // far better than one going out empty.
    console.error("Message template load failed", error);
  }

  return NextResponse.json({ templates: [...merged.values()] });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const key = String(body.key || "").trim();
    if (!DEFAULT_TEMPLATES.some((t) => t.key === key)) {
      return NextResponse.json({ error: "Unknown message." }, { status: 400 });
    }

    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "The message cannot be empty." }, { status: 400 });

    await sql`
      INSERT INTO message_templates (key, label, body, enabled, updated_by)
      VALUES (${key}, ${String(body.label || key).slice(0, 60)}, ${text.slice(0, 4000)}, ${body.enabled !== false}, 'admin')
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        body = EXCLUDED.body,
        enabled = EXCLUDED.enabled,
        updated_at = now(),
        updated_by = 'admin';
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Message template save failed", error);
    return NextResponse.json({ error: "That message could not be saved." }, { status: 500 });
  }
}
