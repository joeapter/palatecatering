# Cook Planner + CaterBase Pro import — Claude handoff

Last updated: 2026-08-27

Repository: `/Users/joeapter/palate-website`

This is the single handoff for the cook-planner project. Start here rather than
repeating the Heroku/schema investigation.

## Owner request

Build a mobile-first Cook Planner shared by the new Palate Admin v2 and the
Kitchen app:

1. Select Palate orders and pull their line items into one assignment workspace.
2. Items start in Unassigned.
3. Staff create cook dates and assign items to those dates.
4. Assigned items leave Unassigned, so staff can systematically reach zero.
5. Completed items leave the active workspace.
6. Staff can print each cook date from Admin or Kitchen, without prices.
7. CaterBase Pro orders can also be selected and imported into this workspace.
8. CaterBase items must **never** be copied into the Palate order list.
9. CaterBase item names must remain separate rather than being matched or
   combined with Palate products. Display customer, item, meal, event date, and
   adult/kid counts.

## Claude's completed research

Heroku CLI is authenticated as `joeapter@gmail.com`; app is `cater-base-pro`.
It is a Django app with Heroku Postgres.

Palate Catering is `caterer_id = 1` in
`client_estimates_catereraccount`. At research time it had 99 estimates.

Relevant CaterBase tables:

- `client_estimates_estimate`
  - `id`, `estimate_number`, `customer_name`, `event_type`, `event_date`
  - `guest_count` (adults), `guest_count_kids`
  - `meal_plan`, `caterer_id`
- `client_estimates_estimatefoodchoice`
  - `id`, `estimate_id`, `menu_item_id`, `meal_name`, `included`, `notes`
- `client_estimates_menuitem`
  - `id`, `name`

Every observed food choice had `included = true` and
`servings_per_person = 1.00`. There is no reliable order-status field, so the
correct product behavior is manual selection of CaterBase estimates to import.

## Implementation completed

### Database

`migrations/0023_cook_planner.sql` adds two additive tables:

- `cook_days`: one row per production date.
- `cook_items`: immutable imported line-item snapshots with:
  - source type (`palate` or `caterbase`);
  - source order and line IDs;
  - customer/event/meal/item details;
  - Palate quantity/unit OR CaterBase adults/kids;
  - optional notes;
  - cook-day assignment;
  - completion state.

Unique constraint `(source_type, source_order_id, source_line_key)` makes imports
idempotent. Re-importing the same order cannot duplicate its lines.

CaterBase rows exist only in `cook_items`. No code inserts them into `orders`.

### Read-only CaterBase connection

`lib/caterbase.ts` uses the newly-added `pg` dependency and
`CATERBASE_DATABASE_URL`.

- SSL enabled with Heroku-compatible settings.
- Pool capped at two connections.
- Every query filters `e.caterer_id = 1`.
- There are only SELECT queries. This project cannot update CaterBase.
- Estimate list includes events from 30 days ago forward, capped at 250.
- Import query returns each included food-choice row with meal, customer,
  event date, adults and kids.

### APIs

Both signed Admin and signed Kitchen sessions are accepted.

- `GET /api/cook-list`
  - active cook dates and all incomplete workspace items.
- `POST /api/cook-list`
  - `createDay`
  - `assign` (a day ID or null to return to Unassigned)
  - `complete`
  - `importPalate`
  - `importCaterBase`
- `GET /api/cook-list/sources?source=palate`
  - recent/upcoming non-cancelled, non-delivered Palate orders.
- `GET /api/cook-list/sources?source=caterbase`
  - read-only selectable CaterBase estimates.

### Shared mobile-first UI

`components/cook-planner.tsx` is used unchanged in both apps.

- Add a cook date.
- Import Orders opens a bottom sheet on phones / side sheet on larger screens.
- Source switch: Palate Orders or CaterBase Pro.
- CaterBase sheet explicitly explains that imports never enter Palate Orders.
- Select one or many source orders and import all their lines.
- Unassigned is the first prominent section.
- Select any number of items, assign them to a cook date, return them to
  Unassigned, or mark them Done.
- Each item shows source, customer, event, order/estimate label, meal, notes,
  and either quantity/unit or adults/kids.
- Day sections show only items assigned to that day.
- UI uses large touch targets and a sticky bulk action bar for phone use.

Routes:

- `/admin/cook-list`
- `/kitchen/cook-list`

Navigation:

- `Cook planner` added to Admin v2 navigation and its mobile burger menu.
- `Cook planner` added to the Kitchen burger menu.

### Day printing

`/kitchen/cook-list/print?dayId=ID` is shared by Admin and Kitchen sessions.

- One price-free cook sheet for the selected day.
- Includes checkbox, item, customer, source/order label, meal, notes,
  quantity/unit or adult/kid counts, and event date.
- Print button and print-specific CSS.
- Every cook-day heading in the planner has a `Print day` link.

## Files added

- `migrations/0023_cook_planner.sql`
- `lib/caterbase.ts`
- `app/api/cook-list/route.ts`
- `app/api/cook-list/sources/route.ts`
- `components/cook-planner.tsx`
- `app/admin/cook-list/page.tsx`
- `app/kitchen/cook-list/page.tsx`
- `app/kitchen/cook-list/print/page.tsx`
- `app/kitchen/cook-list/print/print-button.tsx`

Files changed:

- `app/admin/layout.tsx`
- `components/kitchen/kitchen-header.tsx`
- `package.json`
- `package-lock.json`

## Deployment status and remaining step

Migration `0023_cook_planner.sql` was applied successfully to the configured
Palate Postgres database on 2026-08-27. Verification found both `cook_days` and
`cook_items`, plus the unique source-line constraint. No order data was imported
during migration.

The CaterBase Heroku database URL was added to the linked Vercel project
`joe-apters-projects/palatecatering` on 2026-08-27 as the encrypted sensitive
secret `CATERBASE_DATABASE_URL` for both Production and Preview. The value was
not printed or committed.

Obtain it without printing it into chat or committing it:

```bash
export PATH="/opt/homebrew/bin:$PATH"
heroku config:get DATABASE_URL -a cater-base-pro
```

For local testing, it may also be added to ignored `.env.local`. Never commit
the URL. The current deployment will receive the variable on the next deploy;
deploy the cook-planner changes when they are ready to go live.

## Verification completed

- Installed `pg` and `@types/pg`.
- Read-only connection test against Heroku succeeded:
  `99 Palate estimates visible`.
- Focused ESLint passes for every new cook-planner file.
- `npm run build` passes on Next.js 16.3.1.
- Build includes:
  - `/admin/cook-list`
  - `/kitchen/cook-list`
  - `/kitchen/cook-list/print`
  - `/api/cook-list`
  - `/api/cook-list/sources`

The repository-wide lint command currently fails on pre-existing React 19 lint
rules in unrelated navigation, cart-recovery, kitchen-board and other files.
The new cook-planner files do not contribute an error. Production build passes.

Pre-existing build warnings remain for optional `undici` in the legacy image
route and broad filesystem tracing in legacy email/design code. They are not
caused by this work.

## QA checklist after deployment prerequisites

1. Sign into `/admin/cook-list`; verify it appears in desktop and burger nav.
2. Create two cook dates.
3. Import one Palate order; confirm each order line appears once in Unassigned.
4. Import it again; confirm zero duplicates.
5. Open CaterBase Pro source; confirm upcoming estimates load.
6. Import an estimate with adults and kids; confirm its items show counts and
   meal names, and confirm no new record exists in Palate `/admin/orders`.
7. Assign some items to each day; confirm they disappear from Unassigned.
8. Return one item to Unassigned.
9. Mark one item Done; confirm it leaves the active workspace.
10. Print each day from Admin and Kitchen on a phone; confirm no pricing and
    readable page breaks.
11. Sign into Kitchen only; repeat assignment and printing without Admin access.

## Production deployment

Deployed the complete current workspace to Vercel production on 2026-08-27.

- Vercel project: `joe-apters-projects/palatecatering`
- Current deployment ID: `dpl_HLJbXRkdRUMsSFPY1gyh1253LKtA`
- Production alias: `https://palatecatering.vercel.app`
- Deployment URL: `https://palatecatering-bp9jj9civ-joe-apters-projects.vercel.app`
- Vercel state: `READY`

### Production Palate-order query fix

After the initial deployment, the Palate import tab reported
`column o.delivery_date does not exist`. The current schema stores the selected
date in `order_windows.event_date`; `orders` has no `delivery_date` column.
Both Palate source queries were corrected to use
`COALESCE(ow.event_date, o.created_at::date)`:

- `app/api/cook-list/sources/route.ts`
- `app/api/cook-list/route.ts`

The corrected build was deployed to the current deployment above. An
authenticated production check of
`GET /api/cook-list/sources?source=palate` returned HTTP 200 with five eligible
orders and no error. No orders were imported or modified during this check.

Authenticated production smoke test after deployment:

- Homepage: HTTP 200.
- Admin cook-list page: redirects unauthenticated users to sign-in as expected.
- Kitchen cook-list page: HTTP 200 and shows the kitchen login/session UI.
- Admin login: HTTP 200 with the configured credential.
- `GET /api/cook-list`: HTTP 200; migrated tables reachable; zero items before
  staff imports anything.
- `GET /api/cook-list/sources?source=caterbase`: HTTP 200; returned 18 currently
  eligible CaterBase estimates through the production encrypted secret.

## Recommended next refinements (not required for initial use)

- Completed/history view with Undo.
- Delete/rename cook dates with safety checks.
- Search/filter by item, customer, source or event.
- Optional grouping of identical Palate items on a printed day while preserving
  CaterBase rows separately, if the owner later asks for aggregation.
- Scheduled cleanup/archive for old completed items.
