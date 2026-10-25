import { Pool } from "pg";

let pool: Pool | null = null;

function client() {
  const connectionString = process.env.CATERBASE_DATABASE_URL;
  if (!connectionString) throw new Error("CATERBASE_DATABASE_URL is not configured");
  if (!pool) pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  return pool;
}

export type CaterBaseEstimate = { id: string; estimateNumber: number | null; customerName: string; eventType: string; eventDate: string; adults: number; kids: number; itemCount: number };

export async function listCaterBaseEstimates(): Promise<CaterBaseEstimate[]> {
  const { rows } = await client().query(`
    SELECT e.id::text, e.estimate_number, e.customer_name, e.event_type,
           e.event_date::text, COALESCE(e.guest_count,0) AS adults,
           COALESCE(e.guest_count_kids,0) AS kids, count(f.id)::int AS item_count
    FROM client_estimates_estimate e
    JOIN client_estimates_estimatefoodchoice f ON f.estimate_id=e.id AND f.included=true
    WHERE e.caterer_id=1 AND e.event_date >= CURRENT_DATE - 30
    GROUP BY e.id
    ORDER BY e.event_date ASC, e.customer_name ASC
    LIMIT 250
  `);
  return rows.map((row) => ({ id: row.id, estimateNumber: row.estimate_number, customerName: row.customer_name || "", eventType: row.event_type || "", eventDate: row.event_date, adults: Number(row.adults) || 0, kids: Number(row.kids) || 0, itemCount: Number(row.item_count) || 0 }));
}

export async function loadCaterBaseLines(ids: string[]) {
  if (!ids.length) return [];
  const { rows } = await client().query(`
    SELECT e.id::text AS estimate_id, e.estimate_number, e.customer_name,
           e.event_type, e.event_date::text, COALESCE(e.guest_count,0) AS adults,
           COALESCE(e.guest_count_kids,0) AS kids,
           f.id::text AS line_id, COALESCE(f.meal_name,'') AS meal_name,
           m.name AS item_name, COALESCE(f.notes,'') AS notes
    FROM client_estimates_estimate e
    JOIN client_estimates_estimatefoodchoice f ON f.estimate_id=e.id AND f.included=true
    JOIN client_estimates_menuitem m ON m.id=f.menu_item_id
    WHERE e.caterer_id=1 AND e.id::text = ANY($1::text[])
    ORDER BY e.event_date, e.id, f.meal_name, m.name
  `, [ids]);
  return rows;
}
