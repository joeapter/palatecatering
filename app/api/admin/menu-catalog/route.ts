import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getDairyCatalog, getShabbosCatalog } from "@/lib/storefront/catalog";
import { getHolidayMenu } from "@/lib/storefront/holiday";
import { MENUS, MENU_TAGS } from "@/lib/storefront/menus";

export const dynamic = "force-dynamic";

/**
 * The catalogue for one menu, for staff taking an order by hand.
 *
 * The storefront endpoint only ever serves Shabbos, so an order for Rosh
 * Hashanah — or any other seasonal menu — had no dishes to pick from. This
 * reads the same catalogue functions the customer-facing pages use, so a
 * manual order is priced exactly as an online one would be.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const menu = new URL(request.url).searchParams.get("menu") || "shabbos";
  if (!MENU_TAGS.includes(menu)) {
    return NextResponse.json({ error: "Unknown menu." }, { status: 400 });
  }

  try {
    const categories =
      menu === "shabbos" ? await getShabbosCatalog()
      : menu === "dairy" ? await getDairyCatalog()
      : await getHolidayMenu(menu);
    return NextResponse.json({ menu, menus: MENUS, categories });
  } catch (error) {
    console.error("Admin menu catalog error", error);
    return NextResponse.json({ error: "Unable to load that menu." }, { status: 500 });
  }
}
