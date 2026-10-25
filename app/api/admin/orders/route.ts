import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "paid", "in kitchen", "ready", "delivered", "cancelled"];

/**
 * Delivered is done, and done work should not be in the way of work to do.
 *
 * Marking an order delivered takes it off the working list on its own — there
 * is no archive button to remember and no sweep to run, because the status the
 * kitchen already sets is the whole signal. Nothing is deleted: the order is one
 * tab away, for ever, and `is_deleted` remains a separate and deliberate act.
 *
 * Only delivered. Cancelled orders stay on the list on purpose, because a
 * cancellation is usually still owed a refund or a phone call.
 */
const ARCHIVED_STATUS = "delivered";

const ORDER_FIELDS = `id, order_number, created_at, status, customer_name, customer_phone,
         customer_email, customer_address, shabbos_label, total, items, allergies, is_manual`;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const windowIdParam = url.searchParams.get("windowId");
    const windowId = windowIdParam ? Number(windowIdParam) : null;
    const scopeParam = url.searchParams.get("scope");
    const archived = scopeParam === "delivered";
    const dispatch = scopeParam === "dispatch";

    // COALESCE, not a bare comparison: a NULL status must stay on the working
    // list rather than vanish from both views.
    const statusClause = archived
      ? `COALESCE(status,'') = '${ARCHIVED_STATUS}'`
      : `COALESCE(status,'') <> '${ARCHIVED_STATUS}'`;

    const conditions = ["COALESCE(is_deleted,false) = false", statusClause];

    /**
     * Who is getting a delivery-window message.
     *
     * Orders waiting to go out, which is `new` and `ready` both: the kitchen
     * does not always move an order to ready before it is loaded, so dispatching
     * only off `ready` would leave orders on the van and their customers
     * unmessaged.
     *
     * Pickups are excluded — there is no delivery window to tell them about.
     * Fulfilment is read from `shabbos_label`, which is where the storefront
     * writes it ("… · Delivery to Jerusalem", "… · Pickup in Beit Shemesh");
     * the address cannot be used, because pickup orders carry one too.
     *
     * A label with neither word is NOT excluded. An order taken by hand can be
     * saved without that suffix, and dropping it silently would hide a real
     * delivery on the one day it matters — the board flags it to be checked
     * instead.
     */
    if (dispatch) {
      conditions.push(`COALESCE(status,'') IN ('new','ready')`);
      conditions.push(`COALESCE(shabbos_label,'') NOT ILIKE '%pickup%'`);
    }
    const params: unknown[] = [];
    if (windowId) {
      params.push(windowId);
      conditions.push(`order_window_id = $${params.length}`);
    }
    const where = conditions.join(" AND ");
    // A window's delivered orders are worth showing in full; the unfiltered
    // archive is only ever browsed, so it stays capped.
    const limit = windowId ? 300 : archived ? 200 : 100;
    // Dispatch is read while loading a van, so it is ordered the way the route
    // is walked — by address — rather than by when the order came in.
    const order = dispatch ? "customer_address NULLS LAST, order_number" : "created_at DESC";

    const [orders, counts, windows] = await Promise.all([
      sql.query(
        `SELECT ${ORDER_FIELDS} FROM orders WHERE ${where} ORDER BY ${order} LIMIT ${limit}`,
        params,
      ),
      // All three tallies come from one pass so each tab can show what is
      // waiting in the others without a second round trip.
      sql.query(
        `SELECT
           count(*) FILTER (WHERE COALESCE(status,'') <> '${ARCHIVED_STATUS}')::int AS active,
           count(*) FILTER (WHERE COALESCE(status,'') = '${ARCHIVED_STATUS}')::int AS delivered,
           count(*) FILTER (WHERE COALESCE(status,'') IN ('new','ready')
                              AND COALESCE(shabbos_label,'') NOT ILIKE '%pickup%')::int AS dispatch
         FROM orders
         WHERE COALESCE(is_deleted,false) = false${windowId ? " AND order_window_id = $1" : ""}`,
        windowId ? [windowId] : [],
      ),
      sql`SELECT id, name FROM order_windows ORDER BY event_date DESC LIMIT 20;`,
    ]);

    return NextResponse.json({
      orders: orders.rows,
      windows: windows.rows,
      statuses: STATUSES,
      scope: archived ? "delivered" : dispatch ? "dispatch" : "active",
      counts: counts.rows[0] || { active: 0, delivered: 0, dispatch: 0 },
    });
  } catch (error) {
    console.error("Admin orders error", error);
    return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))]
      : [];

    if (body.action === "bulkStatus" || body.action === "bulkDelete") {
      if (!ids.length) return NextResponse.json({ error: "Select at least one order." }, { status: 400 });
      if (ids.length > 300) return NextResponse.json({ error: "Change at most 300 orders at once." }, { status: 400 });
      if (body.action === "bulkStatus") {
        const status = String(body.status || "");
        if (!STATUSES.includes(status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
        const result = await sql.query(
          "UPDATE orders SET status = $1 WHERE id = ANY($2::int[]) AND COALESCE(is_deleted,false) = false RETURNING id",
          [status, ids],
        );
        return NextResponse.json({ ok: true, changed: result.rowCount });
      }
      const result = await sql.query(
        "UPDATE orders SET is_deleted = true, deleted_at = now() WHERE id = ANY($1::int[]) AND COALESCE(is_deleted,false) = false RETURNING id",
        [ids],
      );
      return NextResponse.json({ ok: true, changed: result.rowCount });
    }

    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    if (body.action === "status") {
      const status = String(body.status || "");
      if (!STATUSES.includes(status)) {
        return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      }
      await sql`UPDATE orders SET status = ${status} WHERE id = ${id};`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin order update error", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
