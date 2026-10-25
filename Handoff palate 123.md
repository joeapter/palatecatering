# Handoff palate 123

Repo: `joeapter/palatecatering` (static site + Vercel serverless functions in `api/`, auto-deploys from `main`).

## Background (from previous session)

- The customer is ordering an **office party** with items that aren't in the catalog. The total is **₪4,800**.
- PR #1 (merged, live) added a **"Custom item (not in catalog)"** box to the order detail page in `admin.html`. Flow: Create new order → add a custom item ("Office Party", price, qty) → Generate link → Copy link.
- Payment links come from `api/stripe/additional-link.js`, which **hardcodes `currency: 'ils'`** for both line items and the discount coupon. The admin UI shows all prices as ₪ (`formatProductPrice` in `admin.html`).
- **The `STRIPE_SECRET_KEY` in the cloud session env is NOT Palate's.** It belongs to `acct_1TaKv0QagJKU5pfA` ("BitLink", live mode). Never use it for this work.
- **Use `Palate_Mobile_Secret_Key`** (env var added by Joe). It's probably a live key, so **read-only calls only** unless Joe confirms otherwise.
- Joe says Palate's Stripe account is in **Canada**, pays out in **USD**, and Stripe converts every ILS charge to USD.
- The session's proxy blocks public FX-rate APIs (frankfurter.app, open.er-api.com). Get the rate from Stripe data or from Joe.

## Goal

Bill the ₪4,800 office party so the customer can pay in **USD** (shown first), with ILS as a fallback.

## Tasks

1. **Verify the key.** Run `curl -sS https://api.stripe.com/v1/account -u "$Palate_Mobile_Secret_Key:"`. Confirm it is Palate (business name, country `CA`, `default_currency`). Stop and tell Joe if it isn't.
2. **Inspect the account (read-only) so Joe understands the FX costs:**
   - Payout setup: `GET /v1/accounts/{id}/external_accounts` (or `/v1/account` → `external_accounts`). Check the payout bank currencies.
   - Recent ILS charges: `GET /v1/charges?limit=20&expand[]=data.balance_transaction`. For each, report the amount in ILS, the `balance_transaction.exchange_rate`, the USD net, and the `fee_details` breakdown (processing fee vs currency-conversion fee). Show the real % lost to conversion.
   - If any USD charges exist, compare their fees.
   - `GET /v1/balance` for the balance currencies.
   - Summarize for Joe in plain language: what an ILS charge costs today versus a USD charge.
3. **Answer Joe's questions, using the real data:**
   - *Customer in Israel with an American card:* yes, it works. Stripe charges by card, not by where the person is. On a USD-priced link the US card is charged in USD, so the customer pays no foreign-transaction fee. Palate probably pays Stripe's international-card surcharge (non-Canadian card), but no conversion fee because the payout is USD. Confirm against Stripe's current Canadian pricing and the data in step 2.
   - With ILS charges, Palate pays Stripe's currency-conversion fee (ILS→USD), and a US cardholder may also pay their bank's foreign-transaction fee. Charging in USD likely avoids both.
   - Adaptive Pricing picks the currency by customer **location** (IP), not by Palate's choice. So "USD first, toggle to ILS" on one link isn't directly possible. Plan: a USD link as the main one, plus an optional ILS link.
4. **Build a USD option** (branch `claude/custom-stripe-office-party-v65144`, already reset to `main`):
   - `api/stripe/additional-link.js`: accept `currency` in the body (allow-list `ils` / `usd`, default `ils`). Use it for `price_data.currency` and the coupon `currency`, and add it to the link metadata.
   - `admin.html` (Pending payment panel, near `orderDetailPageGenerateLink`): add a **Charge in: ILS / USD** select. When USD is selected, show a **USD amount** input (or an exchange-rate input) and send USD prices. Labels must show `$` vs `₪` correctly; `formatProductPrice` is hardcoded to ₪. Also fix the discount placeholder "Discount amount ($)" to match the selected currency.
   - Check the webhook (`api/stripe/webhook.js`) and the order totals/emails (`api/send-order-email.js`) for ILS assumptions, so a USD payment still marks the order paid and doesn't record the wrong amount.
   - Validate: syntax-check the admin script (`node --check` on the extracted `<script>`), and test the endpoint logic locally with a mocked Stripe if possible.
   - Open a PR, merge it once Joe says deploy, then confirm the Vercel status on the commit.
5. **Create the office party links:** confirm the USD amount with Joe first (₪4,800 converted, using his rate or the Stripe rate from step 2, rounded as he likes). Then either walk Joe through the admin, or create them with `Palate_Mobile_Secret_Key` if he OKs it:
   - USD link: "Office Party", the agreed USD amount, qty 1.
   - ILS link: "Office Party", ₪4,800, qty 1 (fallback).
   - Use `after_completion` redirect `https://palatecateringisrael.com/` as in the existing endpoint. Note that links created outside the admin won't be tied to an order row in the DB.

## Rules

- Live keys: no charges, refunds or setting changes without Joe's explicit OK. Creating a payment link is fine only after he confirms the amount.
- Don't put any key values in commits or files.
