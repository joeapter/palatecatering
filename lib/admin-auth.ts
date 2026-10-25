import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Admin access for the new dashboard.
 *
 * The legacy admin sent ADMIN_PASSWORD on every request as `x-admin-key`, which
 * means the password itself sits in browser memory and in every request log.
 * Here the password is exchanged once for a signed, httpOnly cookie, so it is
 * never held by the client after sign-in. ADMIN_PASSWORD remains the single
 * credential, so nothing new has to be provisioned.
 */

const COOKIE_NAME = "palate_admin";
/**
 * Sixty days, not twelve hours.
 *
 * The admin is used from a phone on the home screen, and a session that
 * expired overnight meant retyping the password on a small keyboard every
 * morning. The cookie is httpOnly, signed, and scoped to this site; the
 * realistic risk is a lost unlocked phone, which is what Sign out is for.
 */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

function secret(): string {
  const value = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("JWT_SECRET or ADMIN_PASSWORD must be set");
  return value;
}

function sign(expiresAt: number): string {
  const mac = createHmac("sha256", secret()).update(`admin:${expiresAt}`).digest("hex");
  return `${expiresAt}.${mac}`;
}

function verify(token: string): boolean {
  const [rawExpiry, mac] = token.split(".");
  const expiresAt = Number(rawExpiry);
  if (!expiresAt || !mac || Date.now() > expiresAt) return false;
  const expected = createHmac("sha256", secret()).update(`admin:${expiresAt}`).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(expected);
  // Length is compared separately because timingSafeEqual throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminCookie() {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  return {
    name: COOKIE_NAME,
    value: sign(expiresAt),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  };
}

export const adminCookieName = COOKIE_NAME;

/** For Server Components and pages. */
export async function isAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    return Boolean(token && verify(token));
  } catch {
    return false;
  }
}

/**
 * For route handlers. Accepts the admin cookie, or the legacy `x-admin-key`
 * header so existing tooling and the old admin page keep working.
 */
export function isAdminRequest(request: Request): boolean {
  const legacyKey = request.headers.get("x-admin-key");
  if (legacyKey && checkPassword(legacyKey)) return true;
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return Boolean(match && verify(decodeURIComponent(match[1])));
}
