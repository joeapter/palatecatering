import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { isKitchenRequest } from "@/lib/kitchen-session";
import { listCaterBaseEstimates } from "@/lib/caterbase";

export const dynamic = "force-dynamic";
function allowed(request: Request) { return isAdminRequest(request) || isKitchenRequest(request); }

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const source = new URL(request.url).searchParams.get("source") || "palate";
  try {
    if (source === "caterbase") return NextResponse.json({ orders: await listCaterBaseEstimates() });
    const { rows } = await sql`
      SELECT o.id::text, o.order_number, o.customer_name,
             COALESCE(ow.event_date, o.created_at::date)::text AS event_date,
             o.shabbos_label, jsonb_array_length(COALESCE(o.items,'[]'::jsonb))::int AS item_count
      FROM orders o LEFT JOIN order_windows ow ON ow.id=o.order_window_id
      WHERE COALESCE(o.is_deleted,false)=false
        AND o.status NOT IN ('cancelled','delivered')
        AND COALESCE(ow.event_date, o.created_at::date) >= CURRENT_DATE - 7
      ORDER BY event_date, o.order_number LIMIT 250;
    `;
    return NextResponse.json({ orders: rows.map((row) => ({ id: row.id, estimateNumber: row.order_number, customerName: row.customer_name || "", eventType: row.shabbos_label || "Palate order", eventDate: row.event_date, adults: 0, kids: 0, itemCount: row.item_count })) });
  } catch (error) { console.error("Cook-list sources error", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load orders." }, { status: 500 }); }
}
