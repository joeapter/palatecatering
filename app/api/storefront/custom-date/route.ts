import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

/**
 * An order for a date that is not a Shabbos or Yom Tov — a bris, a sheva
 * brachos, a Tuesday.
 *
 * The same cutoff rule as the weekly menu, applied to whatever date is chosen:
 * ordering closes at 23:59 two days before. So the earliest date anyone can
 * pick is two days from today, and choosing that leaves them until tonight.
 *
 * Creating a real order window rather than a special case on the order means
 * the cutoff, the kitchen list, the per-window figures and the late-order
 * banner all work with no extra concept to maintain.
 */
export const dynamic = "force-dynamic";

/** Far enough ahead for a simcha; short enough that the table cannot be filled with junk. */
const MAX_DAYS_AHEAD = 180;
const MIN_DAYS_AHEAD = 2;

/**
 * Stretches the kitchen is away. The weekly windows are closed in the admin by
 * pulling their cutoff forward, but a custom date is created on demand, so it
 * has to be refused here. Inclusive, Israel dates.
 */
const CLOSED_DATES: { from: string; to: string }[] = [
  { from: "2026-09-29", to: "2026-10-10" },
];

export async function POST(request: Request) {
  try {
    const { date } = await request.json();
    const day = String(date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: "Choose a date." }, { status: 400 });
    }

    // All the date arithmetic happens in Postgres, in Israel time. Doing it in
    // the browser would use the customer's own timezone, and someone ordering
    // from abroad would get a different cutoff to the kitchen's.
    const { rows: check } = await sql`
      SELECT
        ${day}::date AS chosen,
        (now() AT TIME ZONE 'Asia/Jerusalem')::date AS today_il,
        ${day}::date - (now() AT TIME ZONE 'Asia/Jerusalem')::date AS days_ahead,
        (((${day}::date - interval '2 days')::date + time '23:59')
          AT TIME ZONE 'Asia/Jerusalem') AS cutoff_at,
        to_char(${day}::date, 'FMDay') AS weekday,
        to_char(${day}::date, 'FMDD FMMon') AS pretty;
    `;
    const info = check[0];
    const daysAhead = Number(info.days_ahead);

    if (daysAhead < MIN_DAYS_AHEAD) {
      return NextResponse.json(
        { error: `We need at least ${MIN_DAYS_AHEAD} days. The earliest date you can choose is ${MIN_DAYS_AHEAD} days from today.` },
        { status: 400 },
      );
    }
    if (daysAhead > MAX_DAYS_AHEAD) {
      return NextResponse.json({ error: "That is too far ahead — please call us for a date that far out." }, { status: 400 });
    }

    // ISO dates compare correctly as strings.
    if (CLOSED_DATES.some((range) => day >= range.from && day <= range.to)) {
      return NextResponse.json(
        { error: "We are closed for that date. Please choose a date after 10 October." },
        { status: 400 },
      );
    }

    // A date that already has a window — a Shabbos, or another customer's
    // custom date — is reused rather than duplicated.
    const { rows: existing } = await sql`
      SELECT id, name, slug, event_type, event_date::text AS event_date, cutoff_at
      FROM order_windows
      WHERE event_date = ${day}::date AND active = true AND cutoff_at > now()
      ORDER BY is_custom ASC
      LIMIT 1;
    `;
    if (existing.length) return NextResponse.json({ window: existing[0], reused: true });

    const name = `${info.weekday} · ${info.pretty}`;
    const { rows } = await sql`
      INSERT INTO order_windows (name, slug, event_type, event_date, cutoff_at, opens_at, active, is_custom)
      VALUES (
        ${name}, ${`custom-${day}`},
        -- Stays 'shabbos' so the everyday menu applies; see migration 0022.
        'shabbos', ${day}::date, ${info.cutoff_at}, now(), true, true
      )
      ON CONFLICT (slug) DO UPDATE SET active = true, cutoff_at = EXCLUDED.cutoff_at
      RETURNING id, name, slug, event_type, event_date::text AS event_date, cutoff_at;
    `;

    return NextResponse.json({ window: rows[0] });
  } catch (error) {
    console.error("Custom date failed", error);
    return NextResponse.json({ error: "That date could not be set up." }, { status: 500 });
  }
}
