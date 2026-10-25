import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { getCurrentUser } from "@/lib/session";
import { ensureStripeCustomer } from "@/lib/stripe/customer";

/**
 * Prices and totals are decided here, from the database, and never from the
 * browser. The client sends product/variant ids and quantities only.
 */

type RequestLine = { productId?: number; variantId?: number; bundleId?: number; quantity: number };

type PricedItem = {
  productId?: number;
  variantId?: number;
  bundleId?: number;
  title: string;
  soldBy: string;
  price: number;
  quantity: number;
};

/** Guards against a client sending an absurd quantity on a variant with no maximum. */
const ABSOLUTE_QUANTITY_CAP = 500;
const MAX_DISTINCT_LINES = 200;
const FULFILLMENT_TYPES = new Set(["pickup", "delivery"]);

/** Money is summed as integer agorot so repeated float addition can't drift. */
function toAgorot(price: number, quantity: number): number {
  return Math.round(price * 100 * quantity);
}

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const rawLines = Array.isArray(body.lines) ? (body.lines as RequestLine[]) : [];
    if (!rawLines.length) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }
    if (rawLines.length > MAX_DISTINCT_LINES) {
      return NextResponse.json({ error: "That is too many items for one order." }, { status: 400 });
    }

    // A repeated product/variant must be merged before validation. Checking each
    // line on its own would let two lines of 10 slip past a maximum of 10.
    const mergedLines = new Map<string, RequestLine>();
    for (const line of rawLines) {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "A cart item is invalid." }, { status: 400 });
      }

      if (line.bundleId) {
        const bundleId = Number(line.bundleId);
        if (!bundleId) return NextResponse.json({ error: "A cart item is invalid." }, { status: 400 });
        const key = `bundle:${bundleId}`;
        const existing = mergedLines.get(key);
        mergedLines.set(key, { bundleId, quantity: (existing?.quantity ?? 0) + quantity });
        continue;
      }

      const productId = Number(line.productId);
      const variantId = line.variantId ? Number(line.variantId) : null;
      if (!productId) {
        return NextResponse.json({ error: "A cart item is invalid." }, { status: 400 });
      }
      const key = `${productId}:${variantId ?? "base"}`;
      const existing = mergedLines.get(key);
      mergedLines.set(key, {
        productId,
        variantId: variantId ?? undefined,
        quantity: (existing?.quantity ?? 0) + quantity,
      });
    }

    // Fulfillment must be stated explicitly. Treating an unrecognised value as
    // pickup would hand out free delivery on a malformed request.
    const fulfillment = String(body.fulfillment || "");
    if (!FULFILLMENT_TYPES.has(fulfillment)) {
      return NextResponse.json({ error: "Choose pickup or delivery." }, { status: 400 });
    }

    // A preview window from the degraded settings fallback has a string id like
    // "preview-next-shabbos". It can never be ordered against, and the old
    // "Choose a current order window" told the customer to do the one thing
    // that would not help — the list itself was the problem.
    const windowId = Number(body.orderWindowId);
    if (!Number.isInteger(windowId) || windowId <= 0) {
      return NextResponse.json(
        { error: "Ordering is briefly unavailable. Please call 058-728-0062 and we will take your order over the phone.", code: "window_unavailable" },
        { status: 503 },
      );
    }

    const windowResult = await sql`
      SELECT id, name, event_date, cutoff_at, event_type
      FROM order_windows
      WHERE id = ${windowId}
        AND active = true
        AND (opens_at IS NULL OR opens_at <= now())
      LIMIT 1;
    `;
    const orderWindow = windowResult.rows[0];
    if (!orderWindow || new Date(orderWindow.cutoff_at) <= new Date()) {
      // `code` is what lets the browser reopen the date picker instead of
      // leaving a full basket sitting behind an error message.
      return NextResponse.json(
        { error: "Ordering has closed for this date. Choose another date and your basket comes with you.", code: "window_closed" },
        { status: 409 },
      );
    }

    // Which menu a dish came from does not restrict the date it can be bought
    // for. Erev Sukkos is also erev Shabbos and both runs are cooked the same
    // Friday, so a basket that mixes the two is an ordinary order, not a
    // mistake — refusing it lost a customer her whole basket over a container
    // of chummus. What still has to hold is that the dish is on sale and the
    // date is open, both checked below.

    const pricedItems: PricedItem[] = [];
    let subtotalAgorot = 0;

    for (const line of mergedLines.values()) {
      const { productId, variantId, bundleId, quantity } = line;

      // Packages are priced from the bundles table, never from the browser, and
      // an inactive bundle (one still awaiting price approval) cannot be bought.
      if (bundleId) {
        if (!Number.isInteger(quantity) || quantity > ABSOLUTE_QUANTITY_CAP) {
          return NextResponse.json({ error: "Choose a valid package quantity." }, { status: 400 });
        }
        const bundleResult = await sql`
          SELECT id, name, price, serves
          FROM bundles
          WHERE id = ${bundleId} AND active = true
          LIMIT 1;
        `;
        const bundle = bundleResult.rows[0];
        if (!bundle) {
          return NextResponse.json(
            { error: "A package in your cart is no longer available." },
            { status: 409 },
          );
        }
        const bundlePrice = Number(bundle.price);
        if (!Number.isFinite(bundlePrice) || bundlePrice <= 0) {
          return NextResponse.json(
            { error: `${bundle.name} is not available to order right now.` },
            { status: 409 },
          );
        }
        subtotalAgorot += toAgorot(bundlePrice, quantity);
        pricedItems.push({
          bundleId,
          title: bundle.name,
          soldBy: String(bundle.serves || "Package"),
          price: bundlePrice,
          quantity,
        });
        continue;
      }

      const result = variantId
        ? await sql`
            SELECT p.id, p.title, pv.id AS variant_id, pv.label, pv.sold_by, pv.price,
                   pv.minimum_quantity, pv.quantity_step, pv.maximum_quantity
            FROM products p
            JOIN product_variants pv ON pv.product_id = p.id
            WHERE p.id = ${productId} AND pv.id = ${variantId}
              AND p.active = true AND pv.active = true
            LIMIT 1;
          `
        : await sql`
            SELECT p.id, p.title, NULL::integer AS variant_id,
                   COALESCE(NULLIF(p.sold_by, ''), 'Each') AS label,
                   p.sold_by, p.price,
                   1::numeric AS minimum_quantity, 1::numeric AS quantity_step,
                   NULL::numeric AS maximum_quantity
            FROM products p
            WHERE p.id = ${productId} AND p.active = true
            LIMIT 1;
          `;

      const row = result.rows[0];
      if (!row) {
        return NextResponse.json(
          { error: "An item in your cart is no longer available." },
          { status: 409 },
        );
      }

      const minimum = Number(row.minimum_quantity) || 1;
      const step = Number(row.quantity_step) || 1;
      const maximum = row.maximum_quantity == null ? ABSOLUTE_QUANTITY_CAP : Number(row.maximum_quantity);
      const stepCount = (quantity - minimum) / step;
      const offStep = Math.abs(stepCount - Math.round(stepCount)) > 0.000001;

      if (quantity < minimum || quantity > maximum || offStep) {
        return NextResponse.json(
          { error: `Choose a valid quantity for ${row.title}.` },
          { status: 400 },
        );
      }

      const price = Number(row.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          { error: `${row.title} is not available to order right now.` },
          { status: 409 },
        );
      }

      subtotalAgorot += toAgorot(price, quantity);
      pricedItems.push({
        productId,
        variantId: row.variant_id || undefined,
        title: row.title,
        soldBy: row.sold_by || row.label,
        price,
        quantity,
      });
    }

    let deliveryAgorot = 0;
    let deliveryLabel = "Pickup in Beit Shemesh";

    if (fulfillment === "delivery") {
      const zoneId = Number(body.deliveryZoneId);
      const zones = await sql`
        SELECT id, name, fee, minimum_order, free_delivery_threshold
        FROM delivery_zones
        WHERE id = ${zoneId} AND active = true
        LIMIT 1;
      `;
      const zone = zones.rows[0];
      if (!zone) {
        return NextResponse.json(
          { error: "We no longer deliver to the area saved with your basket. Choose another area, or switch to pickup.", code: "zone_invalid" },
          { status: 400 },
        );
      }

      const minimumAgorot = Math.round(Number(zone.minimum_order) * 100);
      if (subtotalAgorot < minimumAgorot) {
        return NextResponse.json(
          { error: `The minimum for ${zone.name} is ₪${Number(zone.minimum_order)}. Add ₪${((minimumAgorot - subtotalAgorot) / 100).toFixed(0)} more, or switch to pickup.`, code: "below_minimum" },
          { status: 400 },
        );
      }

      const freeThreshold = zone.free_delivery_threshold == null
        ? null
        : Math.round(Number(zone.free_delivery_threshold) * 100);
      const qualifiesFree = freeThreshold != null && subtotalAgorot >= freeThreshold;
      deliveryAgorot = qualifiesFree ? 0 : Math.round(Number(zone.fee) * 100);
      deliveryLabel = `Delivery to ${zone.name}`;
    }

    const totalAgorot = subtotalAgorot + deliveryAgorot;
    if (totalAgorot <= 0) {
      return NextResponse.json({ error: "That order total is not valid." }, { status: 400 });
    }

    const customerEmail = String(body.customer?.email || "").trim().slice(0, 200);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Saved cards are tied to an account, never to a typed email address.
    // A Stripe customer is attached whenever someone is signed in, because the
    // customer is also what lets them *use* a card saved on a previous visit;
    // the card is only retained when they explicitly ask for it.
    const account = await getCurrentUser();
    let stripeCustomerId: string | undefined;
    if (account) {
      try {
        stripeCustomerId = await ensureStripeCustomer(stripe, account);
      } catch (error) {
        // Losing saved cards is survivable; losing the order is not. Fall back
        // to a plain guest-style payment.
        console.error("Stripe customer setup failed", error);
      }
    }
    const saveCard = Boolean(body.saveCard) && Boolean(stripeCustomerId);

    const intent = await stripe.paymentIntents.create({
      amount: totalAgorot,
      currency: "ils",
      // Left to Stripe's automatic methods so 3-D Secure and local wallets work;
      // the redirect that follows is handled on the thank-you page.
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail || undefined,
      description: `Palate order · ${orderWindow.name}`,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      // `off_session` is what makes the card reusable on a later visit rather
      // than only within this one. Set solely when the box was ticked.
      ...(saveCard ? { setup_future_usage: "off_session" as const } : {}),
      metadata: {
        order_window_id: String(windowId),
        customer_email: customerEmail,
        item_count: String(pricedItems.length),
        pricing: "server_authoritative_v2",
        ...(account ? { user_id: String(account.id) } : {}),
        // Read back on completion to close out the abandoned-cart row, and
        // named to match what the legacy webhook path already looks for.
        ...(/^[A-Za-z0-9_-]{8,64}$/.test(String(body.cartId || ""))
          ? { recovered_cart_id: String(body.cartId) }
          : {}),
      },
    });

    const total = totalAgorot / 100;
    const payload = {
      customer: body.customer || {},
      items: pricedItems,
      total,
      shabbosLabel: `${orderWindow.name} · ${deliveryLabel}`,
      notes: body.notes || "",
      deliveryNotes: body.deliveryNotes || "",
      paymentIntentId: intent.id,
    };

    await sql`
      INSERT INTO checkout_sessions (payment_intent_id, order_window_id, payload, amount)
      VALUES (${intent.id}, ${windowId}, ${JSON.stringify(payload)}::jsonb, ${total})
      ON CONFLICT (payment_intent_id)
      DO UPDATE SET payload = EXCLUDED.payload, amount = EXCLUDED.amount, updated_at = now();
    `;

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      summary: {
        subtotal: subtotalAgorot / 100,
        deliveryFee: deliveryAgorot / 100,
        total,
      },
    });
  } catch (error) {
    console.error("Checkout intent error", error);
    // Usually a dropped database connection, which the next attempt survives.
    // "Unable to prepare checkout." told the customer nothing and gave them no
    // reason to try again, so a blip that lasts one second lost the basket.
    return NextResponse.json(
      { error: "Something went wrong preparing your payment — please try again. If it keeps happening, call 058-728-0062 and we will take the order.", code: "retry" },
      { status: 500 },
    );
  }
}
