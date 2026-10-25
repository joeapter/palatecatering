# Palate storefront rebuild — complete Claude handoff

Last updated: 2026-08-17

Repository: `/Users/joeapter/palate-website`

Branch: `rosh-hashanah-2026`

This is the single authoritative handoff. It supersedes the older phase-specific
handoffs while retaining their important details. Read this file before making
changes.

## Owner direction and scope authority

Follow the deliberate phase order in Claude's original rebuild proposal. Do not
pull later requests or conversational brainstorming forward into the current
phase.

- Phase 1: Next.js foundation.
- Phase 2: storefront.
- Phase 3: packages and accounts.
- Phase 4: Admin v2.
- Phase 5: notifications.
- Phase 6: SEO/content and optional assistant.

The owner explicitly corrected earlier scope drift: package/bundle storefronts,
accounts, order history and reorder are Phase 3; the proper admin product,
variation, category, bundle, window, order and hero managers are Phase 4.

Design requirements from the owner:

- Goldy's is a structural reference, not a visual design to copy.
- Palate should be Shabbos-first, while event catering remains visible but does
  not occupy the entire homepage.
- Category pages need photographic category tiles at the top and real URLs.
- Use Palate's existing food photography wherever possible.
- Avoid generic AI religious shorthand such as staged challah or candles. It
  looks artificial to the customer.
- Product sales eventually need pieces, weight, volume, pans/containers and
  premade packages. The variation storefront belongs to Phase 2; packages are
  Phase 3; their proper admin builders are Phase 4.
- The Kashrus page retains the new page design, but its hechsher logos sit on
  white cards. The Beit Shemesh certificate stays small, followed by the full
  accepted-hechsher breakdown from the old site.
- Footer line: “Delicious Mehadrin food, prepared with care for Shabbos tables,
  Yom Tov, and simchas.”
- Desktop mega-menu closes when the pointer leaves; it must not remain open due
  to focus state.

## Working-tree warning

The tree is intentionally uncommitted and dirty. Do not reset or broadly revert
it. It contains owner/earlier-agent work and pre-existing deleted Netlify files,
`.DS_Store` changes, legacy page edits and Phase 0.5 work.

`npm install` also modified tracked files inside `node_modules` because this repo
unusually tracks parts of that directory. Do not review or commit those blindly.
The meaningful dependency changes are in `package.json` and `package-lock.json`.

## Phase 0.5 — retained seasonal work

The earlier quick-win implementation remains in the tree:

- `rosh-hashanah.html` uses the proven legacy ordering/cart/Stripe flow.
- `data/rosh-hashanah-menu.json` has 72 items across nine categories; 65 reuse
  verified local images.
- `api/products.js` seeds/tag products and exposes Rosh Hashanah settings.
- Seven new products seed inactive with `needs_price_review = true`: Round
  Challah, Round Raisin Challah, Simanim Platter, Apple & Honey Set, Classic
  Honey Cake, Tzimmes, and Pomegranate & Fruit Platter.
- `admin.html` has the Rosh Hashanah filter, review badge and holiday settings.
- `index.html` and `sitemap.xml` include the seasonal campaign/page.
- Provisional default cutoff is Tuesday 2026-09-08 at 23:59 Israel time. Confirm
  with the owner before production.
- Seed marker: `site_settings.rosh_hashanah_seeded_at`.

Do not confuse this legacy quick-win page with the Next.js rebuild.

## Phase 1 — completed foundation

The repository root is now a Next.js 16 App Router app with React 19,
TypeScript and compiled Tailwind CSS 4.

Architecture:

- `app/`: Next.js routes and server-rendered storefront.
- `components/`: shared header, footer, category rail/cards and product UI.
- `lib/storefront/`: typed catalog and merchandising adapters.
- `app/api/auth/*`: ported login/register plus HTTP-only session cookie.
- `app/api/storefront/*`: catalog and storefront settings endpoints.
- Root `api/`: retained legacy serverless order/email/kitchen functions.
- Legacy `.html` pages remain reachable through `public/` symlinks during the
  staged cutover. Do not remove them until parity is proven.
- `vercel.json` uses Next.js and retains the kitchen action rewrite.

Implemented routes include `/`, `/shabbos`, eight
`/shabbos/[category]` pages, `/holidays`, `/catering`, `/kashrus`, `/packages`
(placeholder until Phase 3), `/admin` (foundation only until Phase 4), and the
auth/storefront APIs.

Phase 1 migration:

- `migrations/0005_storefront_foundation.sql` adds categories, normalized
  product variants, future bundle tables, order windows, delivery zones, hero
  slides, and additive product/user/order fields.

Visual work:

- Shabbos-first global navigation and utility bar.
- Goldy's-inspired category mega-menu in Palate's visual language.
- Real server-rendered category URLs, breadcrumbs, category photo rail and
  product grids.
- Homepage uses Palate photography.
- Kashrus page restored with the old site's accepted-hechsher details and white
  logo cards.
- Mega-menu hover-close behavior fixed.
- Footer wording updated as directed.

Optional generated assets, not wired into the generic homepage:

- `assets/generated/rosh-hashanah-campaign-v1.webp`
- `assets/generated/catering-campaign-v1.webp`

Only use those after owner review and only if a suitable real Palate photograph
does not exist. The rejected generic generated Shabbos image was not retained.

## Phase 2 — implementation status when work stopped

The owner asked to stop during Phase 2. Code is implemented and builds, but the
phase is not production-verified or declared complete.

Implemented:

1. Product variations
   - `migrations/0006_product_variant_units.sql` adds unit type/value/label,
     min/step/max quantities and serving ranges.
   - `lib/storefront/catalog.ts` prefers normalized `product_variants`, with
     legacy JSON/base-price fallback.
   - `components/product-card.tsx` has variation selection and quantity controls
     for piece, weight, volume and container/pan options.

2. Order context and cart
   - `components/storefront-provider.tsx` persists guest cart and order context
     in localStorage.
   - First Begin Order/Add prompts for order window, pickup/delivery and zone.
   - `components/order-context-banner.tsx` shows the active date, fulfillment,
     zone and cutoff with an Edit action.
   - Cart drawer supports quantity changes/removal, delivery pricing and a
     free-delivery progress bar.
   - Header actions show cart count and Begin/Edit Order.

3. Homepage merchandising
   - `lib/storefront/merchandising.ts` reads active `hero_slides` and recommended
     product badges.
   - `components/hero-slider.tsx` implements the rotating campaign hero.
   - Homepage includes category tiles and a recommendation row.
   - Fallbacks always use Palate photography/data.

4. Secure checkout implementation
   - `/checkout` and `/thank-you` routes added.
   - `components/checkout-form.tsx` collects customer details, optional order
     notes and fulfillment notes and renders Stripe Payment Element.
   - `app/api/checkout/intent/route.ts` ignores browser-declared prices. It
     re-reads active products/variants from Postgres, validates min/step/max
     quantities, validates the active order window/cutoff, calculates delivery
     minimums/fees/free-delivery, and creates the PaymentIntent from the
     server-authoritative total.
   - `app/api/checkout/complete/route.ts` verifies succeeded payment and amount,
     then hands the authoritative payload to the existing
     `/api/send-order-email` pipeline so orders, email, PDFs and kitchen print
     are not duplicated in a second implementation.
   - `migrations/0007_checkout_sessions.sql` stores the authoritative checkout
     payload and provides an idempotent completion marker.

5. Temporary Phase 2 data before Admin v2
   - `migrations/0008_phase2_initial_storefront.sql` seeds rolling Shabbos order
     windows and starter hero slides using Palate images. These are temporary
     direct-DB records until the Phase 4 managers exist.
   - `/api/storefront/settings` supplies safe local preview fallbacks when the
     migrations/database are unavailable. Preview fallback IDs cannot be used
     for a real checkout; production checkout requires actual DB rows.

## Phase 2 checkout review — completed, with fixes applied

The checkout lifecycle review (item 1 below) was carried out and found four
defects that would have lost or duplicated real orders. All are fixed; none of
the fixes are verified against a live database or Stripe yet.

1. **Orders were lost on 3-D Secure.** `confirmPayment` used
   `redirect: "if_required"`, and any payment needing off-site authentication
   navigated to `/thank-you`, which was a static page. `/api/checkout/complete`
   never ran, so the customer was charged and no order reached the kitchen. SCA
   makes this a routine path in Israel, not an edge case.
   - Added `app/api/stripe/webhook/route.ts` on `payment_intent.succeeded` as the
     authoritative order-creation path. Requires new env `STRIPE_WEBHOOK_SECRET`.
   - `/thank-you` is now dynamic and renders `components/checkout-finalizer.tsx`,
     which completes the order when Stripe returns via redirect.

2. **Completion was not atomic.** Both callers read `status` and then acted, so
   a browser call racing the webhook could dispatch the same order twice.
   Completion now claims the row with a conditional `UPDATE ... WHERE status IN
   ('pending','failed')`; the loser becomes a no-op.

3. **Unrecognised `fulfillment` silently meant free pickup.** Any value other
   than `"delivery"` fell through to pickup with no delivery fee. Now rejected
   unless it is exactly `pickup` or `delivery`.

4. **Duplicate cart lines bypassed `maximum_quantity`.** Lines were validated
   individually, so two lines of 10 passed a maximum of 10. Lines are now merged
   by product+variant before validation, with an absolute cap for variants that
   have no maximum.

Also changed:

- Order completion lives in one place, `lib/checkout/complete.ts`, shared by the
  browser route, the webhook and manual recovery.
- Cutoff is enforced before payment only. After a successful charge a late order
  is fulfilled and flagged for the kitchen rather than rejected — refusing it
  would take money for food nobody is making.
- Money is summed in integer agorot in the intent route.
- `payment_method_types: ["card"]` became `automatic_payment_methods`, so 3-D
  Secure and local methods work properly.
- `migrations/0009_checkout_session_reliability.sql` adds `attempts`,
  `last_error`, `last_attempt_at`, `completed_by` and a needs-attention index.
- `app/api/admin/checkout-recovery/route.ts` (GET/POST, `x-admin-key`) lists
  paid-but-incomplete sessions and retries them. A failed dispatch is otherwise
  invisible.

Note: `/api/send-order-email` has no authentication. It creates orders, sends
mail and queues kitchen print jobs, and is publicly callable. Pre-existing, but
it should be closed before launch; legacy pages call it directly from the
browser, so the fix has to cover them too.

## Phase 2 — VERIFIED end to end (2026-08-17)

Run against a Neon **preview branch** (timeline `6a8f2274…`, not production
`f8b9827a…`) with Stripe **test** keys. Migrations `0005`–`0009` applied to the
branch. Production database and live Stripe were not touched.

Local test setup now lives in `.env.development.local` (gitignored). Next.js
loads it ahead of `.env.local` in dev, so `npm run dev` uses test Stripe + the
branch DB. `npm run build` runs in production mode and ignores that file — do
all checkout testing with `npm run dev`.

Verified:

- Server-authoritative pricing: client sending `price: 1` still charged ₪50.
- `fulfillment: "DELIVERY"` rejected (previously free pickup).
- Duplicate cart lines merged: 300 + 300 rejected against the cap.
- Delivery fee ₪20 applied; free-delivery threshold at ₪500 honoured.
- Unknown product → 409; invalid/closed order window → 409.
- Full order: intent → Stripe confirm → webhook → order row → kitchen print job.
  Orders #1680, #1681, #1682 created **in the branch**.
- Webhook-only path confirmed (`completed_by=webhook`, no browser call) — this
  is the 3-D Secure case that previously lost the order entirely.
- Idempotency: 5 concurrent completions + a replayed Stripe webhook produced
  `already_complete` every time; order count unchanged.
- Failure path: when dispatch 404'd, the session went to `status=failed` with
  the error recorded, **no phantom order**, and the admin recovery endpoint
  retried it to `complete`.

Three further defects were found and fixed during this run:

1. **Every legacy `api/*.js` endpoint was 404ing.** `vercel.json` declares
   `"framework": "nextjs"`, so Next.js owns `/api/*` and the root serverless
   functions were orphaned — breaking the new checkout *and* the live HTML
   pages, which fetch `/api/products`. Added `lib/legacy-api-adapter.ts` and
   `app/api/[...legacy]/route.ts`, which shim the `(req,res)` signature so the
   original handlers run unmodified. Specific routes still take priority over
   the catch-all.
2. **pdfkit was broken under the bundler.** First `PDFDocument is not a
   constructor` (ESM interop), then `ENOENT …/Helvetica.afm` because bundling
   rewrites the font-metrics path. Fixed with a defensive `.default` unwrap and
   `serverExternalPackages: ["pdfkit", "nodemailer"]` in `next.config.ts`.
3. **The kitchen rewrite only existed in `vercel.json`,** which `next dev` does
   not read. Mirrored into `next.config.ts` so dev and production match.

### Regression found and fixed: Rosh Hashanah tagging emptied the Shabbos menu

Every `/shabbos/<category>` page was returning 404. Cause was in the Phase 0.5
Rosh Hashanah seeder, and it would have damaged production on first deploy.

A product with `menu_tags` NULL/empty means "Shabbos" by the legacy convention —
the Shabbos query matches `menu_tags @> ARRAY['shabbos'] OR menu_tags IS NULL`.
The seeder saw NULL, treated it as "no tags yet", and wrote
`ARRAY['rosh-hashanah']`. That value is not NULL and does not contain
`shabbos`, so 60 products silently dropped out of the Shabbos menu. The
storefront `catch` then fell back to `data/shabbos-menu.json`, so `/shabbos`
still listed eight categories while the category pages themselves 404'd — which
is why it looked like a routing bug rather than a data bug.

- `api/products.js` now writes `ARRAY['shabbos','rosh-hashanah']` in that branch.
- `migrations/0010_repair_shabbos_menu_tags.sql` backfills rows already written
  the old way (60 rows on the preview branch), excluding the genuinely-new
  `Rosh Hashanah Specials` items.

**Production has not been damaged** — these changes are uncommitted and the
deployed site still runs the previous code. Migration `0010` must be applied as
part of the same deploy that ships the seeder fix.

Worth noting for later: the silent `catch → fallbackCatalog()` in
`lib/storefront/catalog.ts` turned a data fault into a confusing 404 with no log
line. It should at least warn in production.

Still not verified: real browser QA (hero, mega-menu, cart persistence,
mobile), accessibility/focus trapping, and a genuine 3-D Secure card journey in
a browser. Test orders #1680–#1682 exist in the branch only; delete the branch
to discard them.

## Phase 2 items still required

Do these before calling Phase 2 complete:

1. ~~Review the Phase 2 code, especially the checkout lifecycle and persisted
   cart, before applying database changes.~~ Done — see above.
2. Apply migrations `0005`, `0006`, `0007`, `0008`, and `0009` in order to a
   preview Postgres database. They have not been applied by this handoff.
3. Confirm preview environment variables:
   - existing `POSTGRES_*` variables;
   - `STRIPE_SECRET_KEY`;
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (new dependency of Payment Element);
   - `STRIPE_WEBHOOK_SECRET` (new — required by `/api/stripe/webhook`);
   - `ADMIN_PASSWORD` (used by `/api/admin/checkout-recovery`);
   - `NEXT_PUBLIC_SITE_URL` or equivalent, so the webhook can reach
     `/api/send-order-email` when there is no incoming request origin;
   - existing Gmail/order/kitchen variables used by `api/send-order-email.js`.
4. Run a Stripe test-mode order end to end. Confirm:
   - current DB price overrides any manipulated browser price;
   - expired cutoff is rejected;
   - quantity constraints and delivery minimums/fees are enforced;
   - payment succeeds;
   - exactly one order row is created;
   - customer/admin confirmation email is correct;
   - order and kitchen PDFs generate;
   - kitchen print job is queued;
   - repeat completion calls remain idempotent.
5. Perform real browser QA at desktop and mobile widths:
   - hero rotation/controls;
   - mega-menu pointer exit;
   - order chooser and edit flow;
   - variation changes and fractional quantity steps;
   - cart persistence after refresh;
   - pickup and all delivery zones;
   - checkout errors and successful thank-you path.
6. Check accessibility: modal focus trapping/return, Escape close, keyboard cart
   drawer, labels and visible focus. The current modal/drawer are functional but
   do not yet implement a complete focus trap.
7. Revisit cutoff semantics. The intent route enforces cutoff immediately before
   PaymentIntent creation, which is the normal direct checkout path. For strict
   enforcement against an unusually long delay between intent creation and
   confirmation, add a short checkout-session expiry or a Stripe webhook policy
   before launch.
8. Remove the commented former static hero JSX from `app/page.tsx` after visual
   acceptance; it is harmless but should not remain as dead code.
9. Rerun `npm run lint`, `npm run build`, and `git diff --check` excluding tracked
   `node_modules` noise.

## Verification already completed

Immediately before this handoff:

- `npm run lint` passed with no errors after the final navigation fix.
- `npm run build` passed on Next.js 16.3.1.
- Build generated 26 routes/pages, including checkout, thank-you, checkout APIs,
  Shabbos hub and all category pages.
- `git diff --check` only reported pre-existing/newly-installed tracked
  `node_modules/@types/node/README.md` trailing whitespace; no authored
  application file whitespace failure was reported.

No preview database migration, Stripe charge, email, PDF or kitchen queue test
was run. Do not claim payment flow is production-verified yet.

## Phase 3 — packages, accounts, reorder (built and verified 2026-08-17)

Verified on the same Neon preview branch with Stripe test keys.

**Packages / bundles**

- `migrations/0011_bundle_pricing_and_seed.sql` adds `needs_price_review`,
  `serves_min/max`, `menu` to `bundles`, and seeds three packages whose contents
  resolve against real products: Shabbos Essentials (₪420 vs ₪510 à la carte),
  The Full Shabbos Table (₪850 vs ₪1045), Kiddush Spread (₪720 vs ₪800).
- **Those prices are proposals, not Palate's pricing.** All three seed
  `active = false, needs_price_review = true` and cannot be bought until someone
  approves them — checkout returns 409 for an inactive bundle. They were
  activated on the preview branch for testing only.
- `lib/storefront/bundles.ts` computes the à-la-carte total from live product
  prices, so the saving shown is always real rather than stored and stale.
- `/packages` and `/packages/[slug]`, with an honest empty state while pricing
  is unconfirmed. `components/bundle-card.tsx`, `bundle-add-button.tsx`.
- Cart carries bundle lines (`kind: "bundle"`, key namespaced `bundle:<id>` so
  it can never collide with a product id).
- The checkout intent route prices bundles from the `bundles` table. Verified:
  a client sending `price: 1` for a ₪420 package is still charged ₪420.

**Accounts**

- `/account/login` (sign in + create account) and `/account` (order history).
- `lib/session.ts` reads the session cookie in Server Components.
- `app/api/auth/logout/route.ts` added.
- Order history matches `user_id` **or** `customer_email`, so orders placed as a
  guest before registering still appear — which is what customers expect.

**Reorder**

- `app/api/account/reorder/route.ts` rebuilds a cart from a past order,
  **re-pricing every line against the current catalog** rather than copying old
  prices, and reporting anything no longer available instead of dropping it
  silently. Requires auth (401 otherwise) and only returns the caller's orders.

**Launch cutover**

- 308 redirects from the legacy `.html` URLs are written in `next.config.ts` but
  **gated behind `LAUNCH_CUTOVER=true` and are OFF**. `shabbos.html` is still the
  shop taking real orders; enabling them early would take ordering down. Turn
  them on only once the new storefront has proven parity.

Verified end to end: mixed package + product cart → Stripe → webhook → order
#1683 (₪470) with both line types recorded correctly.

## Package pricing decision (owner, 2026-08-17)

Packages are sold at the **full price of their contents** — no discount. The
value is that the menu is already decided, and that the kitchen can batch one
package for a whole week. `migrations/0012_bundle_full_price_and_weekly.sql`
repriced the three seeded packages to their contents total (₪510 / ₪1045 / ₪800),
cleared the review flag and made them live. All "save ₪X" wording is gone from
the storefront; packages read as a "Package rate".

That migration also adds `bundles.order_window_id` and `bundles.batch_limit`,
which is what makes packages weekly: a package tied to a window is only offered
that week and disappears when the window's cutoff passes, so the kitchen is
never asked to produce last week's batch.

## Phase 4 — Admin v2 (built and verified 2026-08-17)

New admin at `/admin`, separate from the legacy `admin.html`, which still works.

**Auth.** `lib/admin-auth.ts`. The legacy admin sent `ADMIN_PASSWORD` on every
request as `x-admin-key`, so the password lived in browser memory and in request
logs. It is now exchanged once for a signed httpOnly cookie. The same
`ADMIN_PASSWORD` is the credential, and `x-admin-key` is still accepted so
existing tooling keeps working. Verified: unauthenticated `/admin` 307s to
`/admin/login`, admin APIs 401, wrong password rejected.

**Pages.** Dashboard, Packages, Price review, Order windows, Orders.

- **Dashboard** — current window with a countdown, orders and revenue for it,
  and a red banner when a payment was taken but never became an order.
- **Packages** — the weekly builder. Create a package, assign it to a week, set
  the batch you intend to make, add/remove dishes. **The price always follows the
  contents** and is recalculated server-side on every change, so it cannot drift
  from what the dishes cost. Verified: adding dishes moved it ₪100 → ₪200 → ₪390,
  matching contents exactly.
- **Price review** — the queue of items whose price was generated rather than
  set by staff. They are seeded inactive, so nothing with an unconfirmed price can
  be sold; confirming the price is what publishes it. Verified: confirming Round
  Challah at ₪30 activated it and dropped the queue from 7 to 6.
- **Order windows** — create/close weeks. A window with orders against it is
  closed rather than deleted.
- **Orders** — filter by window, change status, and a **Kitchen totals** view
  that sums every dish across all orders in the window, which is what the kitchen
  actually needs to know. Also carries the payment-recovery retry.

## Phase 5 — Notifications (first cut, 2026-08-17)

**WhatsApp, zero-cost.** `lib/notifications/messages.ts` +
`components/admin/whatsapp-actions.tsx`. Buttons on each order open WhatsApp with
the message already written (order confirmed / ready / out for delivery). No
Business API approval, no per-message cost, and staff see the message before it
goes. The Business API can replace the transport later without changing these
templates. Israeli number handling is unit-tested: `058-728-0062`, `0587280062`,
`+972 58 728 0062`, `972…` and bare 9-digit forms all normalise correctly.

**Email.** `lib/notifications/email.ts` renders a branded template (table-based,
inline styles) and `app/api/admin/notify/route.ts` sends ready /
out-for-delivery notices. Order confirmations deliberately still come from the
existing `api/send-order-email.js` pipeline — duplicating that would risk two
confirmations for one order. Added dev dependency `@types/nodemailer`.

**Broadcasts (`/admin/customers`).** The customer list is built from orders, so
it is always people who actually bought. Pick a week and it shows who has *not*
ordered yet — the exact audience for a cutoff reminder. Each row has a WhatsApp
"Remind" button with the message pre-written, and selected customers can be sent
an email broadcast for the weekly menu drop. Emails are sent individually so
recipients never see each other's addresses, and the endpoint caps a single send
at 200 people because a blast is hard to take back.

Still to do in Phase 5: abandoned-cart WhatsApp (the email flow already exists),
and moving WhatsApp from click-to-send to the Business API once volume justifies
it — the message templates in `lib/notifications/messages.ts` will not need to
change.

## Phase 6 — SEO & content (2026-08-17)

**Technical.**

- `app/sitemap.ts` generates the sitemap from the live catalog (24 URLs), so a
  new category or package is submitted automatically. Worth knowing: the old
  static `sitemap.xml` at the repo root **was never reachable** — it was not
  symlinked into `public/`, so nothing had been submitted at all.
- `app/robots.ts` allows the storefront and excludes `/admin`, `/account`,
  `/checkout`, `/thank-you` and `/api`.
- `lib/seo/structured-data.ts` + `components/json-ld.tsx`. `FoodEstablishment`
  site-wide, plus `ItemList` + `Product` on category pages, `Product` on package
  pages, `FAQPage`, `Article` on guides, and `BreadcrumbList` throughout. Every
  block was verified to parse as valid JSON.
- Canonicals and OpenGraph on category, package, guide and FAQ pages.

**Content.**

- `/faq` — 15 answers across ordering, delivery, kashrus, portions, payment and
  events, written to stand alone because this is the text an answer engine
  quotes. Where a number is a policy Palate must confirm (fees, cutoffs), the
  wording points at the live source instead of stating a figure that could go
  stale.
- `/guides` with three full guides: how much food to order per person, reheating,
  and planning a kiddush. Written to be useful to someone who never buys
  anything, because that is what earns the ranking.
- `/holidays` hub with evergreen per-holiday URLs (no year in the slug, so
  equity accumulates), and `/holidays/rosh-hashanah` live — the simanim mapped
  to dishes Palate already makes, the full RH menu, and a prominent note that
  yom tov runs Friday evening to Sunday night this year, which means four meals
  back to back and deliveries that must all land before candle lighting.

## INCIDENT 2026-08-17 — live Shabbos menu lost 60 products

**Cause.** Two dev servers were running locally against **production** (Vercel
gives Development the same Postgres and live Stripe as Production). They were
serving a locally-edited `api/products.js` containing the Rosh Hashanah seeder.
A request to `/api/products` ran that seeder against the live database, which
overwrote `menu_tags` on 60 products with `{rosh-hashanah}`. Because NULL
`menu_tags` means "Shabbos", those products silently left the Shabbos menu — the
live site went from 70 items to 10.

**Repair.** Full snapshot taken to `menu_tags_backup_20260817` (145 rows, still
present and still the rollback path), then Shabbos membership restored and the
erroneous tag removed. Live API verified back to 8 categories / 70 items.

**Follow-ups done.** The Rosh Hashanah seeder is retired. The dairy and Shavuos
seeders had the identical NULL-overwrite bug and **run on every production
request** — both now preserve Shabbos membership.

**Follow-up still open, and it is the real fix:** split the Vercel
Development/Preview environment variables off production. Until that is done any
local `npm run dev` can write to live data. This is the highest-priority task in
the repo.

## Stripe webhook — one endpoint, two flows (2026-08-18)

**No new Stripe endpoint is needed.** Palate already has one registered and
active, `memorable-bliss` (`we_1SsfpRHvQR9vTlca2sCwq34r`), pointing at
`https://www.palatecateringisrael.com/api/stripe/webhook` — the exact path the
new Next.js route serves — subscribed to `payment_intent.succeeded`,
`payment_intent.payment_failed` and `checkout.session.completed`, 0% error rate.
The existing `STRIPE_WEBHOOK_SECRET` is the right one.

**A near-miss worth recording.** That URL was previously served by the legacy
`api/stripe/webhook.js`. Under Next.js, `app/api/stripe/webhook/route.ts` takes
the path, so deploying would have silently replaced it and dropped two things
the legacy handler did:

1. Payment links — marking pending items paid, clearing
   `pending_payment_link`/`pending_payment_url`, and moving the order out of
   `payment_link_sent`.
2. Abandoned carts — marking a cart `recovered`.

Both are now merged into the single route. The two flows are told apart by
metadata: a `checkout_sessions` row means new-storefront checkout; an `order_id`
in metadata means a legacy payment link. Legacy handling runs first and is
isolated in its own try/catch so it can never block order creation.

Verified end to end on the preview branch, both paths in one run:
new checkout → order #1684 created with `completed_by=webhook`; legacy link →
order moved `payment_link_sent` → `new`, `pending_payment_url` cleared, item
flipped `pending:false, paid:true`.

**Do not delete `api/stripe/webhook.js`** without re-reading it against the
merged route — it is currently unreachable but remains the reference for what
the legacy flow expects.

## Order windows — a year seeded, six weeks shown (2026-08-18)

`migrations/0016_shabbos_windows_year.sql`.

**Cutoff is Wednesday 23:59 Israel time** — three days before Shabbos, matching
the legacy `shabbos_close_days_before` / `shabbos_close_time` convention. The
earlier seed stored `19:00 UTC`, which surfaced as **22:00 Israel**; that was the
timezone bug the owner spotted. Times are now written as Israel local and
converted with `AT TIME ZONE 'Asia/Jerusalem'`, so the offset is correct either
side of the daylight-saving change — verified: a 23 Oct cutoff stores as 20:59
UTC and a 6 Nov cutoff as 21:59 UTC, both rendering 23:59 Israel.

**52 weeks of Fridays are seeded**, but `opens_at` is set six weeks before each
date and `/api/storefront/settings` now honours it, so customers only ever see
about six upcoming windows while the kitchen and admin can see the full year.
Re-run the migration any time to top the year back up; it skips dates that
already exist.

A holiday window **replaces** the plain Shabbos window on the same date — the
Shabbos · Sep 11 window is deactivated because Rosh Hashanah begins that Friday
evening and offering both would ask the customer to pick between two names for
one meal.

Delivery pricing confirmed correct by the owner: Beit Shemesh/RBS ₪20,
Jerusalem ₪100, Modiin ₪100, free over ₪500 / ₪1000.

**Date off-by-one fixed.** `event_date` is a `DATE`; serialising it through a JS
Date shifted it a day earlier once the server offset was applied, so the admin
windows table showed the wrong day. It is now selected as `event_date::text` in
both the storefront and admin endpoints and parsed at midday for display.

## Neon branches — which is which

All three live in the same Neon project (`long-river-39575114`, tenant
`4ef40c5b…`), so they are told apart by **timeline id**, not by hostname. The
project also contains an unrelated `exhale` database; the Connect widget in the
Neon console defaults its **Database** dropdown to `exhale`, so always check the
connection string ends `/neondb` before using it.

| Purpose | Endpoint | Timeline | State |
|---|---|---|---|
| **Production** (live site) | `ep-fancy-mud-agyog3w8` | `f8b9827a…` | Pre-migration. Do not run migrations here without the owner's go-ahead. |
| **Preview / local dev** | `ep-quiet-tooth-agl54i5a` | `6a8f2274…` | Migrations 0005–0015 applied. This is what `.env.development.local` points at. |
| **Pre-launch backup** | `ep-tiny-fog-agwsowg0` | `cd1b8d90…` | Snapshot of production taken 2026-08-18 **after** the menu repair: 145 products, 80 orders, 70 on the Shabbos menu, none of the new tables. **Leave untouched — this is the rollback.** |

Every migration script in this repo aborts if the target timeline is
`f8b9827a…`; that guard must stay until a production run is deliberately
intended.

## GO-LIVE — done 2026-08-18

The new storefront **is** palatecateringisrael.com. What was executed, in order:

1. Every migration `0005`–`0016` was read for destructive statements first —
   none contain `DROP`, `DELETE` or `TRUNCATE` — then applied to production. All
   twelve succeeded.
2. The live product count was checked before and after: **70 products across 8
   categories, unchanged**. (A page-summarising fetch claimed 68; a direct
   `psql` count is what settled it. Trust the database, not a summariser.)
3. Three commits shipped: `a22e4fd` the storefront, `f652f3f` `public/` as real
   files, `8febe1d` removal of the colliding legacy `api/stripe/webhook.js`
   after its behaviour was merged into the Next.js route.
4. Two deploy blockers were fixed on the way — `public/` symlinks pointing at
   their own parent, and a Vercel output collision between the legacy webhook
   and the new route at the same path.

Verified against production after deploy:

- Homepage serves the Next.js app ("Shabbos, handled.") with both mega-menus.
- `/holidays/rosh-hashanah` renders every section at the printed-menu prices
  with quantity + Add controls.
- `/shabbos/salatim` and the other category pages load with products.
- `/packages` returns 404 — `packages_enabled` is `false`, as asked.
- `/admin` 307s to `/admin/login` when signed out; `/api/admin/products` 401s.
  Signed in, `/admin`, `/admin/products`, `/admin/design` and `/admin/orders`
  all serve.
- **Server-authoritative pricing proven on live**: a crafted request declaring
  `price: 1` for two units was charged the real ₪50 + ₪20 delivery = ₪70. The
  probe PaymentIntent was cancelled uncharged and its `checkout_sessions` row
  deleted.
- An `orderWindowId` of `0` is rejected with "Choose a current order window."

Two items remain and both need the owner:

1. **One real order with a real card** — live Stripe keys reject test cards, so
   this cannot be done from here. Confirm the order row, the confirmation email
   and the kitchen print job.
2. **`LAUNCH_CUTOVER=true`** in Vercel, which turns on the 308 redirects from
   the legacy `.html` URLs. Deliberately still unset: until a real order has
   been proven end to end, `shabbos.html` stays reachable as a fallback.

## Admin: products, pricing, design & content (2026-08-18)

- **`/admin/products`** — every product and every variant price, filterable by
  menu and searchable. Prices are *staged* as you type: each edited field
  highlights, the row gets its own **Save**, and a sticky bar offers **Save all
  changes** with a discard. Saving a price clears its review flag. Removing a
  size deactivates it rather than deleting, so past orders still resolve. A
  **Categories** tab edits category names, ordering and visibility.
- **`/admin/design`** — three tabs. *Hero slides*: full CRUD with a visual
  picker over the 120 images already in the repo, so a photo is chosen rather
  than typed. *Page text*: editable copy per page (announcement bar, section
  headings, page intros, footer tagline, phone) with staged edits and one Save.
  *Show / hide sections*: feature flags.
- **Packages can be switched off** from Design → Show / hide sections. When off,
  the nav link disappears and `/packages` and `/packages/[slug]` return 404 —
  both are `force-dynamic` so the toggle takes effect immediately. Verified in
  both directions.
- `migrations/0015_site_content_and_flags.sql` adds `site_content`, the feature
  flags, and five hero slides whose photographs match their words (brisket for
  the Shabbos slide, chummus for salatim, chicken soup for the soup slide, the
  bris pancake station for simchas). The two earlier generic gallery slides were
  deactivated, not deleted — the owner disliked them but they are recoverable
  from Design → Hero slides.
- `lib/site-settings.ts` reads flags and copy for Server Components and falls
  back to the shipped wording if the database is unreachable.

## Rosh Hashanah menu rebuilt from the printed menu (2026-08-17)

The owner supplied the printed Rosh Hashanah holiday takeout menu (the one being
sent to clients) and asked for the earlier placeholder version to be gutted and
replaced with it exactly.

`migrations/0013_rosh_hashanah_2026_menu.sql` does all of it:

- Untags every product previously mis-tagged `rosh-hashanah` that is not part of
  this menu, and deactivates the old `Rosh Hashanah Specials` placeholders.
- Creates 33 products across seven sections — Salatim, Soups, Fish, Meat,
  Chicken, Sides, Kugels & Savories — transcribed from the printed menu with its
  exact descriptions and prices.
- Creates 47 variants: every item carries its size, and the two-size items carry
  both (Half Pan / Full Pan, and 12 Pcs / 24 Pcs for the carrot muffins).
- Idempotent via a `rh26-` slug prefix, which is also how the purge step tells
  this menu apart from Shabbos products.

**The JSON seeder for Rosh Hashanah is retired.** `seedRoshHashanahMenu` in
`api/products.js` is no longer called and carries a comment explaining why: it
tagged existing Shabbos products, and since NULL `menu_tags` means "Shabbos",
that silently removed ~60 products from the Shabbos menu. Migration 0013 owns
this menu now. `data/rosh-hashanah-menu.json` was regenerated from the new data
so the legacy `rosh-hashanah.html` fallback matches.

`/holidays/rosh-hashanah` was rewritten to read as a continuation of the printed
sheet rather than a generic storefront page: parchment ground, deep pomegranate
section headings with the italic serving note, a pomegranate bullet per dish,
and the two pan sizes as priced columns on the right — each price is the add-to-
cart control. **No photography, by request**, since the printed menu has none.
New tokens `--color-pomegranate`, `--color-parchment` and `--color-rule` in
`globals.css` are sampled from the menu.

Note: the printed menu gives the website as `palatecatering.co.il`, while the
site canonical is `palatecateringisrael.com`. Worth confirming which is correct
before the menu goes out more widely.

## Event catering section (2026-08-17)

`/catering` was a placeholder. It is now a hub with five event types, each with
its own page and a mega-menu in the header.

**All content was lifted from the existing site, not written from scratch** —
`bris.html`, `Corporate-Catering.html` and the events section of `index.html`.
It lives in `lib/content/events.ts`.

- **Bris** carries the full legacy package: what's included (chad paami,
  tablecloth rental, hall and buffet setup/breakdown, themed serving dishes,
  balloon centerpiece, drink stations), menu highlights, the three pricing tiers
  (₪80 / ₪85 / ₪95 per person by guest count, minimum 60), the live stations
  (egg ₪25pp, pancake ₪20pp, pizza ₪69pp), and every add-on with its price —
  fish, pasta trays, quiche, salads, wraps, boards and desserts.
- **Corporate** carries the daily-meals, schools/institutions and
  parties/launches strands plus both pricing tiers (Daily Essentials ₪50/meal
  with a 20-serving minimum; Executive & Bespoke up to ₪280/meal).
- **Bar Mitzvah, Bat Mitzvah and Shabbos Simcha Meals** are marked
  `enquiryOnly`. The old site quoted no prices for these, so none are stated
  here either — inventing a per-head figure would commit Palate to a number it
  never agreed. Those pages present what is offered and route to WhatsApp/phone.
- Testimonials from the Elevate Events section carried over verbatim.

The header now has a second mega-menu for the event types, matching the Shabbos
one, and closing on pointer-leave rather than focus. All five pages are in the
sitemap with breadcrumb structured data.

**Note for deploy:** `npm run build` queries the database during static
generation, and it reads `.env.local` (production) rather than
`.env.development.local`. A production build today logs
`relation "categories" does not exist` and silently falls back, because
migrations 0005+ have not been applied there. Apply the migrations **before or
with** the deploy, or the new pages will build from fallback data.

## Package/dependency changes

Key runtime dependencies now include:

- Next.js 16.3.1 / React 19
- Tailwind CSS 4 build tooling
- `@stripe/react-stripe-js`
- `@stripe/stripe-js`
- existing server `stripe`, `@vercel/postgres`, auth, email and PDF packages

Run `npm install` from the repository root. `npm install` reported four audit
findings (one moderate, three high); do not run `npm audit fix --force` without
review because it may introduce breaking dependency changes.

## Deliberate next-phase boundary

After Phase 2 is fully tested and accepted, move to Claude's Phase 3 only:

- bundle/package storefront and package builder behavior for 2/4/6/8 and other
  approved package sizes;
- account/order history;
- reorder-last-order;
- launch cutover and 301 redirects.

Then Phase 4 builds the proper Admin v2. Do not build the new admin during Phase
2 or Phase 3 merely because the future schema exists.

## Useful commands

```bash
cd /Users/joeapter/palate-website
git status --short
npm install
npm run lint
npm run build
npm run dev
```

Local preview is normally `http://localhost:3000`.

## Later Admin v2 addition — bulk order operations

Added after the consolidated Phase 2 handoff at the owner's explicit request.
This is part of the new `/admin/orders` system, not the legacy `admin.html`.

- `components/admin/orders-board.tsx` now supports selecting individual orders
  or every order currently shown by the order-window filter.
- Selected orders can be moved together to any allowed status, including
  `in kitchen`, `ready`, `delivered` and `cancelled`.
- Marking a batch delivered requires confirmation.
- Bulk Delete requires confirmation and uses the legacy system's proven soft
  deletion semantics (`is_deleted = true`, `deleted_at = now()`). Historical
  order rows are retained and hidden from normal admin/customer queries.
- `app/api/admin/orders/route.ts` validates the authenticated admin session,
  whitelists statuses, de-duplicates IDs, caps batches at 300 and performs each
  bulk change with one database statement.
- `/admin/orders/print?mode=kitchen&ids=...` renders a server-selected kitchen
  packet with one page per order: order/customer, allergies/notes, item, size
  and quantity. It does not select or render totals or item prices.
- `/admin/orders/print?mode=driver&ids=...` renders a server-selected driver
  packet with customer, phone, address, notes and a packing checklist. It does
  not select or render totals or item prices.
- Both print pages require the signed Admin v2 cookie and contain print CSS for
  page breaks plus a clear Print packet action.
- Each order card also has a `Print order` action. It opens the authenticated
  print route in `order` mode and includes customer/contact details, item sizes,
  quantities, unit prices, calculated line totals and the saved full order
  total. This is deliberately separate from the price-free kitchen/driver
  formats.

Verification after this addition:

- `npm run lint` passes.
- `npm run build` passes and includes dynamic `/admin/orders/print`.
- Build still reports pre-existing warnings: the preview database does not yet
  have the new bundle/category migrations, optional `undici` is unresolved in
  the legacy product-image function, and the legacy email logo loader triggers
  a broad Turbopack filesystem-tracing warning. None was introduced by the bulk
  order work.
