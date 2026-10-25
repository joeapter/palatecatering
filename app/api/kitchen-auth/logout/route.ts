import { NextResponse } from "next/server";
import { kitchenCookieName } from "@/lib/kitchen-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(kitchenCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
