import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

function fallbackSettings() {
  const friday = new Date();
  friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
  friday.setHours(12, 0, 0, 0);
  const cutoff = new Date(friday); cutoff.setDate(cutoff.getDate() - 2); cutoff.setHours(22, 0, 0, 0);
  return {
    orderWindows: [{ id: "preview-next-shabbos", name: `Shabbos · ${friday.toLocaleDateString("en-IL", { month: "short", day: "numeric" })}`, event_date: friday.toISOString().slice(0, 10), cutoff_at: cutoff.toISOString() }],
    deliveryZones: [
      { id: "preview-beit-shemesh", name: "Beit Shemesh / RBS", fee: 20, minimum_order: 0, free_delivery_threshold: 500 },
      { id: "preview-jerusalem", name: "Jerusalem", fee: 100, minimum_order: 0, free_delivery_threshold: 1000 },
      { id: "preview-modiin", name: "Modiin", fee: 100, minimum_order: 0, free_delivery_threshold: 1000 },
    ], heroSlides: [],
    // Says this list came from nowhere. The browser must not read a missing
    // `requestedWindow` here as proof that a saved date has closed — a database
    // blip would otherwise empty every customer's chosen date at once.
    degraded: true,
  };
}

/**
 * Never cached. Every row here is decided against `now()`, and the answer now
 * also depends on which date the asking browser is holding — a shared or stale
 * copy would hand one customer another's validation result, or freeze a list of
 * dates that have since closed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // A date the customer already holds. Passed so the browser can ask "is what I
  // saved still orderable?" in the same round trip that fetches the list, which
  // is what stops a weeks-old basket reaching payment against a closed window.
  const requestedId = Number(new URL(request.url).searchParams.get("window"));
  const hasRequest = Number.isInteger(requestedId) && requestedId > 0;

  try {
    const [windows, zones, slides, requested] = await Promise.all([
      // `opens_at` is what keeps customers to six weeks ahead: a year of windows
      // exists so the kitchen can plan, but one only becomes selectable six
      // weeks before its date. Without this check the whole year would show.
      sql`SELECT id, name, slug, event_type, event_date::text AS event_date, opens_at, cutoff_at, pickup_slots, delivery_slots
          FROM order_windows
          WHERE active = true
            AND cutoff_at > now()
            AND (opens_at IS NULL OR opens_at <= now())
            -- A date one customer chose for a bris is not on offer to
            -- everyone; they reach theirs through the date picker.
            AND COALESCE(is_custom, false) = false
          ORDER BY event_date
          LIMIT 12`,
      sql`SELECT id, name, slug, fee, minimum_order, free_delivery_threshold FROM delivery_zones WHERE active = true ORDER BY sort_order, id`,
      sql`SELECT id, eyebrow, headline, body, image_url, cta_label, cta_href FROM hero_slides WHERE active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()) ORDER BY sort_order, id`,
      // Deliberately not filtered on `is_custom`: a bris date is missing from
      // the public list by design and must still validate for the one customer
      // who booked it, or they would be bounced off their own date.
      hasRequest
        ? sql`SELECT id, name, slug, event_type, event_date::text AS event_date, opens_at, cutoff_at
              FROM order_windows
              WHERE id = ${requestedId}
                AND active = true
                AND cutoff_at > now()
                AND (opens_at IS NULL OR opens_at <= now())
              LIMIT 1`
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ]);
    const fallback = fallbackSettings();
    return NextResponse.json({
      orderWindows: windows.rows.length ? windows.rows : fallback.orderWindows,
      deliveryZones: zones.rows.length ? zones.rows : fallback.deliveryZones,
      heroSlides: slides.rows,
      // Only answered when asked, and `null` is a real answer: that date has
      // closed. Absent means we never checked.
      ...(hasRequest ? { requestedWindow: requested.rows[0] ?? null } : {}),
      // A fallback list cannot be ordered against, so the answer above would be
      // meaningless; flag it rather than let the browser act on it.
      ...(windows.rows.length ? {} : { degraded: true }),
    });
  } catch { return NextResponse.json(fallbackSettings()); }
}
