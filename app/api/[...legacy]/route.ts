import { NextResponse } from "next/server";
import { runLegacyHandler } from "@/lib/legacy-api-adapter";

/**
 * Serves the original root-level `api/*.js` serverless functions.
 *
 * Next.js matches specific routes before a catch-all, so everything already
 * defined under app/api (checkout, auth, storefront, stripe, admin) still wins.
 * This only picks up paths that would otherwise 404 — which, since the project
 * declared `"framework": "nextjs"`, is every legacy endpoint the live HTML
 * pages and the order pipeline depend on.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Static specifiers so the bundler can resolve them; a dynamic path cannot be
// traced and would fail at build time.
type LegacyModule = { default?: unknown };

const LEGACY_MODULES: Record<string, () => Promise<LegacyModule>> = {
  "send-order-email": () => import("../../../api/send-order-email.js"),
  "products": () => import("../../../api/products.js"),
  "orders": () => import("../../../api/orders.js"),
  "order-status": () => import("../../../api/order-status.js"),
  "order-update": () => import("../../../api/order-update.js"),
  "order-delete": () => import("../../../api/order-delete.js"),
  "product-image": () => import("../../../api/product-image.js"),
  "abandoned-carts": () => import("../../../api/abandoned-carts.js"),
  "auth-login": () => import("../../../api/auth-login.js"),
  "auth-register": () => import("../../../api/auth-register.js"),
};

/**
 * `/api/kitchen/:action` is rewritten to `/api/order-status?__kitchen_action=…`
 * by vercel.json in production. `next dev` does not read those rewrites, so it
 * is applied here too and both environments behave the same way.
 */
const KITCHEN_ACTIONS = new Set(["enqueue", "next", "report", "job-pdf"]);

async function handle(request: Request, ctx: { params: Promise<{ legacy: string[] }> }) {
  const { legacy } = await ctx.params;
  const segments = legacy || [];

  let name = segments[0] || "";
  const extraQuery: Record<string, string> = {};

  if (name === "kitchen" && segments[1] && KITCHEN_ACTIONS.has(segments[1])) {
    extraQuery.__kitchen_action = segments[1];
    name = "order-status";
  }

  const load = LEGACY_MODULES[name];
  if (!load) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mod = await load();
  const handler = (mod.default ?? mod) as never;
  return runLegacyHandler(handler, request, extraQuery);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
