import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";
import { ensureUsersTable, sessionCookie, signSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
  if (!email || password.length < 8) return NextResponse.json({ error: "A valid email and password of at least 8 characters are required" }, { status: 400 });
  await ensureUsersTable(); const hash = await bcrypt.hash(password, 12);
  const { rows } = await sql`INSERT INTO users (email, password_hash, name, phone, address, whatsapp_opt_in) VALUES (${email}, ${hash}, ${String(body.name || "")}, ${String(body.phone || "")}, ${String(body.address || "")}, ${Boolean(body.whatsappOptIn)}) ON CONFLICT (email) DO NOTHING RETURNING id, email, name, phone, address`;
  const user = rows[0]; if (!user) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  const token = signSession({ id: user.id, email: user.email }); const response = NextResponse.json({ token, user }, { status: 201 }); response.cookies.set(sessionCookie.name, token, sessionCookie.options); return response;
}
