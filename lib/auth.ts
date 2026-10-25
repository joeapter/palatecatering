import { sql } from "@vercel/postgres";
import jwt from "jsonwebtoken";

export type SessionUser = { id: number; email: string };
const jwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is required in production");
  return "palate-local-development-only";
};

export async function ensureUsersTable() {
  await sql`CREATE TABLE IF NOT EXISTS users (id serial PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, name text, phone text, address text, whatsapp_opt_in boolean NOT NULL DEFAULT false, email_opt_in boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`;
}
export function signSession(user: SessionUser) { return jwt.sign(user, jwtSecret(), { expiresIn: "30d" }); }
export function verifySession(token: string): SessionUser { return jwt.verify(token, jwtSecret()) as SessionUser; }
export const sessionCookie = { name: "palate_session", options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 } };
