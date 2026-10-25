import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign-in for the kitchen screen.
 *
 * Named `kitchen-session`, not `kitchen-auth`, because `lib/kitchen-auth.js`
 * already exists and is required by the legacy CommonJS order pipeline for
 * `getSiteBaseUrl`. Two modules with the same base name and different
 * extensions resolve to one file: this one shadowed that one, `getSiteBaseUrl`
 * became undefined, and every call to /api/send-order-email threw — which
 * meant paid checkouts produced no order at all. Do not reuse that name.
 *
 * Separate from the admin deliberately. The kitchen screen lives on a shared
 * phone or tablet in a working kitchen, and whoever holds it should be able to
 * print sheets, message customers and move orders along — but not reprice the
 * menu, read revenue, or edit the site. Giving the kitchen the admin password
 * would hand over all of that.
 *
 * KITCHEN_PASSWORD is the credential. If it is not set the door stays shut
 * rather than falling back to the admin password, because a silent fallback
 * would mean thinking you had separated the two when you had not. An admin who
 * is already signed in is let through, so there is no second login just to look
 * at the kitchen view.
 */

const COOKIE_NAME = "palate_kitchen";
// Long-lived on purpose: a tablet in a kitchen should not be logging in again
// mid-Friday because a session lapsed.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function secret(): string {
  const value = process.env.JWT_SECRET || process.env.KITCHEN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("JWT_SECRET, KITCHEN_PASSWORD or ADMIN_PASSWORD must be set");
  return value;
}

function sign(expiresAt: number): string {
  const mac = createHmac("sha256", secret()).update(`kitchen:${expiresAt}`).digest("hex");
  return `${expiresAt}.${mac}`;
}

function verify(token: string): boolean {
  const [rawExpiry, mac] = token.split(".");
  const expiresAt = Number(rawExpiry);
  if (!expiresAt || !mac || Date.now() > expiresAt) return false;
  const expected = createHmac("sha256", secret()).update(`kitchen:${expiresAt}`).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkKitchenPassword(candidate: string): boolean {
  const expected = process.env.KITCHEN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(expected);
  // Length is compared separately because timingSafeEqual throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

export function kitchenCookie() {
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

export const kitchenCookieName = COOKIE_NAME;

/** For Server Components and pages. */
export async function isKitchen(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    return Boolean(token && verify(token));
  } catch {
    return false;
  }
}

/** For route handlers. */
export function isKitchenRequest(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return Boolean(match && verify(decodeURIComponent(match[1])));
}
