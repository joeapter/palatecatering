import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { sessionCookie, verifySession } from "./auth";

export type AccountUser = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
};

/**
 * Reads the session cookie in a Server Component or route handler.
 * Returns null rather than throwing so callers can redirect or 401 themselves.
 */
export async function getCurrentUser(): Promise<AccountUser | null> {
  try {
    const store = await cookies();
    const token = store.get(sessionCookie.name)?.value;
    if (!token) return null;
    const session = verifySession(token);
    const { rows } = await sql`
      SELECT id, email, name, phone, address FROM users WHERE id = ${session.id} LIMIT 1;
    `;
    return (rows[0] as AccountUser) || null;
  } catch {
    return null;
  }
}
