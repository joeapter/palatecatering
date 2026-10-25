import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { isKitchenRequest } from "@/lib/kitchen-session";
import { loadCaterBaseLines } from "@/lib/caterbase";

export const dynamic = "force-dynamic";
function allowed(request: Request) { return isAdminRequest(request) || isKitchenRequest(request); }

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [days, items] = await Promise.all([
      sql`SELECT id, cook_date::text, label FROM cook_days WHERE cook_date >= CURRENT_DATE - 14 ORDER BY cook_date, sort_order, id`,
      sql`SELECT id, source_type, source_order_id, source_order_label, customer_name, event_date::text, meal_name, item_name, sold_by, quantity, adult_count, child_count, notes, cook_day_id, completed FROM cook_items WHERE completed=false ORDER BY event_date NULLS LAST, customer_name, meal_name, item_name`,
    ]);
    return NextResponse.json({ days: days.rows, items: items.rows });
  } catch (error) { console.error("Cook-list load error", error); return NextResponse.json({ error: "Cook planner tables are unavailable. Apply migration 0023." }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json(); const action = String(body.action || "");
    if (action === "createDay") {
      const date = String(body.date || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Choose a date." }, { status: 400 });
      const { rows } = await sql`INSERT INTO cook_days (cook_date,label) VALUES (${date},${String(body.label || "")}) ON CONFLICT (cook_date) DO UPDATE SET label=EXCLUDED.label RETURNING id`;
      return NextResponse.json({ ok: true, id: rows[0].id });
    }
    if (action === "assign") {
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(Number).filter(Boolean) : []; const dayId = body.dayId ? Number(body.dayId) : null;
      if (!itemIds.length) return NextResponse.json({ error: "Select at least one item." }, { status: 400 });
      if (dayId) { const exists = await sql`SELECT 1 FROM cook_days WHERE id=${dayId}`; if (!exists.rows.length) return NextResponse.json({ error: "Cook day not found." }, { status: 404 }); }
      const result = await sql.query("UPDATE cook_items SET cook_day_id=$1, updated_at=now() WHERE id=ANY($2::bigint[]) AND completed=false RETURNING id", [dayId, itemIds]);
      return NextResponse.json({ ok: true, changed: result.rowCount });
    }
    if (action === "complete") {
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(Number).filter(Boolean) : [];
      if (!itemIds.length) return NextResponse.json({ error: "Select at least one item." }, { status: 400 });
      const result = await sql.query("UPDATE cook_items SET completed=true, completed_at=now(), updated_at=now() WHERE id=ANY($1::bigint[]) RETURNING id", [itemIds]);
      return NextResponse.json({ ok: true, changed: result.rowCount });
    }
    // Taking an item off the board without claiming it was cooked.
    //
    // An import brings in every line of an order, and not all of them are the
    // kitchen's: a line cancelled by phone, an estimate imported twice over,
    // the wrong order picked in the sheet. Until now the only way off the board
    // was Done, which says the food was made and takes it into the completed
    // record — so the cook list could only be cleaned by lying about it.
    //
    // The row is deleted outright rather than flagged. A cook_item is a
    // snapshot of a source order, never the original, so nothing is lost that
    // the order does not still hold; and deleting frees the
    // (source_type, source_order_id, source_line_key) key, which is precisely
    // what lets the same order be imported again if this was a mistake.
    if (action === "delete") {
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(Number).filter(Boolean) : [];
      if (!itemIds.length) return NextResponse.json({ error: "Select at least one item." }, { status: 400 });
      const result = await sql.query("DELETE FROM cook_items WHERE id=ANY($1::bigint[]) RETURNING id", [itemIds]);
      return NextResponse.json({ ok: true, removed: result.rowCount });
    }
    if (action === "importPalate") {
      const ids = Array.isArray(body.orderIds) ? body.orderIds.map(Number).filter(Boolean) : []; if (!ids.length) return NextResponse.json({ error: "Select orders to import." }, { status: 400 });
      const result = await sql.query(`SELECT o.id, o.order_number, o.customer_name, COALESCE(ow.event_date,o.created_at::date)::text event_date, o.shabbos_label, o.allergies, o.items FROM orders o LEFT JOIN order_windows ow ON ow.id=o.order_window_id WHERE o.id=ANY($1::int[]) AND COALESCE(o.is_deleted,false)=false`, [ids]);
      let imported=0;
      for (const order of result.rows) for (const [index,item] of (Array.isArray(order.items) ? order.items : []).entries()) {
        // The note written against the dish comes first, then the order-wide
        // allergy note: the cook reads what applies to this pan before what
        // applies to the whole order.
        const notes=[item.note||item.notes||"",order.allergies||""].map((part:string)=>String(part).trim()).filter(Boolean).join(" · ");
        const insert=await sql.query(`INSERT INTO cook_items (source_type,source_order_id,source_line_key,source_order_label,customer_name,event_date,item_name,sold_by,quantity,notes) VALUES ('palate',$1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (source_type,source_order_id,source_line_key) DO NOTHING`, [String(order.id),String(index),`#${order.order_number}`,order.customer_name||"",order.event_date,item.title||item.item||"Item",item.soldBy||item.sold_by||"",Number(item.quantity??item.qty??1)||1,notes]); imported += insert.rowCount || 0; }
      return NextResponse.json({ ok:true, imported });
    }
    if (action === "importCaterBase") {
      const ids = Array.isArray(body.orderIds) ? body.orderIds.map(String).filter(Boolean) : []; if (!ids.length) return NextResponse.json({ error: "Select CaterBase orders to import." }, { status: 400 });
      const lines = await loadCaterBaseLines(ids); let imported=0;
      for (const row of lines) { const insert=await sql.query(`INSERT INTO cook_items (source_type,source_order_id,source_line_key,source_order_label,customer_name,event_date,meal_name,item_name,adult_count,child_count,notes) VALUES ('caterbase',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (source_type,source_order_id,source_line_key) DO NOTHING`, [row.estimate_id,row.line_id,`Estimate #${row.estimate_number||row.estimate_id}`,row.customer_name||"",row.event_date,row.meal_name||"",row.item_name,Number(row.adults)||0,Number(row.kids)||0,row.notes||""]); imported += insert.rowCount || 0; }
      return NextResponse.json({ ok:true, imported });
    }
    return NextResponse.json({ error:"Unknown action." }, { status:400 });
  } catch (error) { console.error("Cook-list update error", error); return NextResponse.json({ error:error instanceof Error ? error.message : "That change could not be saved." }, { status:500 }); }
}
