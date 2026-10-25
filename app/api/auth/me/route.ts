import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie.name)?.value || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ user: null }, { status: 401 });
  try { const session = verifySession(token); const { rows } = await sql`SELECT id, email, name, phone, address, whatsapp_opt_in, email_opt_in FROM users WHERE id = ${session.id} LIMIT 1`; return NextResponse.json({ user: rows[0] || null }, { status: rows[0] ? 200 : 401 }); } catch { return NextResponse.json({ user: null }, { status: 401 }); }
}
