import { NextResponse } from "next/server";
import { adminCookie, adminCookieName, checkPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Admin access is not configured." }, { status: 503 });
  }
  if (!password || !checkPassword(String(password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const cookie = adminCookie();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
