import { NextResponse } from "next/server";
import { checkKitchenPassword, kitchenCookie } from "@/lib/kitchen-session";

/**
 * Exchanges the kitchen password for a signed, long-lived cookie, so the
 * password itself is never held by the browser afterwards.
 *
 * Named `/api/kitchen-auth/*` rather than `/api/kitchen/*` because the legacy
 * printer client already owns `/api/kitchen/:action` through a rewrite, and
 * colliding with it would break the kitchen printer.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.KITCHEN_PASSWORD) {
    return NextResponse.json(
      { error: "Kitchen access is not configured yet. Set KITCHEN_PASSWORD." },
      { status: 503 },
    );
  }

  try {
    const { password } = await request.json();
    if (!checkKitchenPassword(String(password || ""))) {
      return NextResponse.json({ error: "That code is not right." }, { status: 401 });
    }
    const cookie = kitchenCookie();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }
}
