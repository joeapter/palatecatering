# Phase 2 — Storefront

Updated 2026-08-17 on branch `rosh-hashanah-2026`.

## Scope authority

This phase follows the deliberate sequence in Claude's original rebuild
proposal. Later conversational scope drift does not move Phase 3 or Phase 4
work into this phase.

## Included in Phase 2

- Admin-managed homepage hero slider, category tiles and recommendation row.
- Server-rendered category pages and photography-forward product cards.
- Product variations for per-piece, weight, volume and container/pan sales.
- Delivery/order-window selection persisted for the shopping session.
- Persistent guest cart with minimum/free-delivery progress.
- Stripe checkout using server-authoritative product prices.
- Server-side cutoff enforcement at payment time.
- Optional customer order notes.

## Explicitly deferred

- Phase 3: packages/bundle storefront, accounts, order history, reorder-last-order
  and launch redirects.
- Phase 4: the proper Admin v2 dashboard and all product, category, variation,
  bundle, order-window, order-pipeline and hero-slide management screens.
- Phase 5: notification-system upgrade.
- Phase 6: guides, FAQ/content program and on-site ordering assistant.

The Phase 1 migration created the future tables additively, but creating a
table is not the same as implementing its later-phase feature.

## Work log

- Audited Phase 2 against the original proposal after the owner requested a
  return to Claude's deliberate order.
- Added `0006_product_variant_units.sql` for storefront unit metadata and
  normalized base variants. It contains no bundle-builder or Admin v2 work.
- Catalog queries now prefer normalized variation records with per-piece,
  weight, volume and container metadata, while retaining the legacy JSON/base
  price fallback during migration.
- Added a persisted order-window and pickup/delivery chooser, the active-order
  context banner, variation-aware quantity controls, and a localStorage guest
  cart with delivery progress.
- Homepage campaigns now read `hero_slides`, with a safe Palate-photography
  fallback; the recommendation row reads product badges and falls back to real
  photographed menu items until curation begins.
- Added secure checkout pages and server routes. Prices, quantity rules,
  delivery fees/minimums and cutoffs are re-read from Postgres before Stripe
  creates a PaymentIntent. Successful payments feed the existing order email,
  order database, PDFs and kitchen print queue.
- Added `0007_checkout_sessions.sql` for idempotent checkout handoff and
  `0008_phase2_initial_storefront.sql` for temporary rolling Shabbos windows and
  starter hero records before the Phase 4 managers exist.

## Remaining Phase 2 work

1. Apply migrations `0005` through `0008` to the preview Postgres database.
2. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` alongside the existing Stripe
   secret and email/order environment variables.
3. Run a Stripe test-mode payment against the preview database and confirm the
   order email, order row, PDFs and kitchen queue.
4. Complete responsive browser QA with the migrated live catalog.
