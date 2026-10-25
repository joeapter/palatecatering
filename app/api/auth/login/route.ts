import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";
import { ensureUsersTable, sessionCookie, signSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  await ensureUsersTable();
  const { rows } = await sql`SELECT id, email, password_hash, name, phone, address FROM users WHERE email = ${String(email).trim().toLowerCase()} LIMIT 1`;
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const token = signSession({ id: user.id, email: user.email });
  const response = NextResponse.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address } });
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return response;
}
