# Phase 1 — Next.js storefront foundation

Updated 2026-08-17 on branch `rosh-hashanah-2026`.

## Outcome

The repository root is now a Next.js 16 App Router application with TypeScript, React 19 and compiled Tailwind CSS 4. The legacy HTML storefront remains available through `.html` URLs during the staged cut-over; do not delete it until checkout and admin parity are complete.

## New architecture

- `app/` contains the new route tree and server-rendered storefront.
- `components/` contains the shared header, footer, category rail/cards and product cards.
- `lib/storefront/` contains the typed catalog adapter. It reads Postgres when the Phase 1 migration exists and falls back to `data/shabbos-menu.json` for local development.
- `app/api/auth/*` ports login/registration to route handlers and adds an HTTP-only session cookie while retaining the token response for compatibility.
- `app/api/storefront/*` exposes the typed catalog plus order-window/delivery/hero settings.
- `migrations/0005_storefront_foundation.sql` is additive and creates categories, normalized variants, bundles, order windows, delivery zones and hero slides. It also extends products, users and orders.

## Visual/storefront decisions

- Shabbos is the primary commerce path; Event catering is visible in the main navigation but no longer owns the homepage.
- The Shabbos navigation has a Goldy’s-inspired mega-menu, implemented in Palate’s own visual language.
- `/shabbos/[category]` pages are real indexable routes with breadcrumbs, a photographic category rail and server-rendered product grids.
- The homepage hero uses Palate’s actual food photography as a mosaic. Avoid generic AI shorthand such as challah, candles or staged religious props.
- Product/category photography uses existing Palate assets wherever available.

## Generated image assets

Built-in image generation produced two optional campaign candidates:

- `assets/generated/rosh-hashanah-campaign-v1.webp`
- `assets/generated/catering-campaign-v1.webp`

They are intentionally not wired into the generic homepage. Use only after owner review and only where Palate lacks a suitable real wide photograph. The generic generated Shabbos image was rejected and not copied into the project.

## Operational compatibility

- `/` is the new storefront preview.
- `/admin` is the Admin v2 foundation route.
- `/admin.html`, `/shabbos.html`, and the other old `.html` routes remain legacy operational pages via `public/` symlinks.
- Existing serverless functions remain under root `api/`; the new APIs use non-conflicting App Router paths.
- `vercel.json` now identifies the project as Next.js and preserves the kitchen action rewrite.

## Verification

- `npm run lint` passes for the new app (legacy CommonJS is explicitly ignored during migration).
- `npm run build` passes and prerenders the homepage, Shabbos hub and all eight category routes.
- Browser smoke tests were captured at 1440px for `/` and `/shabbos/salatim`.
- The existing `vercel dev` process serves the new root successfully at `http://localhost:3000`.

## Phase 2 entry points

1. Apply and verify `0005_storefront_foundation.sql` on a preview database.
2. Build the delivery/order-window chooser and persist the selection.
3. Add the client cart provider and variant picker, then replace the currently disabled Add buttons.
4. Port Stripe intent/checkout with cutoff enforcement on the server.
5. Make `hero_slides` drive a real campaign carousel in place of the fixed homepage hero.
6. Finish and verify the storefront scope before beginning Phase 3. Packages,
   account/order history, reorder-last-order and launch redirects belong to
   Phase 3; the Admin v2 rebuild belongs to Phase 4.
