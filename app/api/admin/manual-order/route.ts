import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * Orders taken by hand, and payment links for them.
 *
 * Prices come from the catalogue by product and variant id, exactly as the
 * storefront checkout does — staff pick a dish rather than typing an amount, so
 * a manual order cannot quietly be sold at a stale price. A free-text line with
 * its own price is allowed too, because catering quotes exist and refusing them
 * would push the work back to paper.
 */
export const dynamic = "force-dynamic";

const PAYMENT_METHODS = new Set(["cash", "bit", "bank_transfer", "zelle", "card_in_person", "unpaid", "stripe"]);

type Line = { productId?: number; variantId?: number; title?: string; unitLabel?: string; unitPrice?: number; quantity?: number; note?: string };

function clean(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

type PricedItem = { title: string; soldBy: string; quantity: number; price: number; note?: string; productId?: number; variantId?: number };

/**
 * Prices the lines of an order from the catalogue.
 *
 * Shared by taking an order and by editing one, so a revised quote is priced by
 * exactly the same rules as the original — a dish cannot become cheaper or
 * dearer because it was changed on a different screen.
 */
async function priceLines(lines: Line[]): Promise<{ priced: PricedItem[] } | { error: string }> {
  const priced: PricedItem[] = [];
  for (const line of lines) {
    const quantity = Math.max(1, Number(line.quantity) || 1);
    // A note on the line itself — "no onions", "cut in half". It travels with
    // the item into the cook list and onto every printed sheet, which is the
    // whole point of it not being folded into the order-wide note.
    const note = clean(line.note, 300);

    if (line.productId) {
      const { rows } = await sql`
        SELECT p.id, p.title, p.price AS base_price, p.sold_by,
               pv.id AS variant_id, pv.label, pv.price AS variant_price
        FROM products p
        LEFT JOIN product_variants pv
          ON pv.id = ${line.variantId ?? null} AND pv.product_id = p.id AND pv.active = true
        WHERE p.id = ${Number(line.productId)} LIMIT 1;
      `;
      const row = rows[0];
      if (!row) return { error: "One of those dishes no longer exists." };
      priced.push({
        title: String(row.title),
        soldBy: String(row.label || row.sold_by || ""),
        quantity,
        price: Number(row.variant_price ?? row.base_price) || 0,
        note: note || undefined,
        productId: Number(row.id),
        variantId: row.variant_id ? Number(row.variant_id) : undefined,
      });
      continue;
    }

    // A custom line: a quote, a delivery charge, an adjustment.
    const title = clean(line.title, 160);
    if (!title) continue;
    priced.push({ title, soldBy: clean(line.unitLabel ?? "", 60), quantity, price: Number(line.unitPrice) || 0, note: note || undefined });
  }
  return { priced };
}

/** The window's own name, so a printed sheet says which week it is for. */
async function labelForWindow(given: string, windowId: number | null) {
  if (given || !windowId) return given;
  const { rows } = await sql`SELECT name FROM order_windows WHERE id = ${windowId} LIMIT 1;`;
  return String(rows[0]?.name || "");
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action === "paymentLink") return paymentLink(body);
    if (body.action === "update") return update(body);
    if (body.action === "fromCart") return fromCart(body);
    if (body.action !== "create") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    return createOrder(body);
  } catch (error) {
    console.error("Manual order failed", error);
    return NextResponse.json({ error: "That order could not be saved." }, { status: 500 });
  }
}

/**
 * Writing a new order from lines the caller supplies.
 *
 * Shared by an order typed in by hand and one lifted from an abandoned basket,
 * so a basket cannot enter the books under gentler rules than a phone order —
 * same catalogue pricing, same payment methods, same unpaid-waits behaviour.
 */
async function createOrder(body: Record<string, unknown>) {
  const lines: Line[] = Array.isArray(body.lines) ? (body.lines as Line[]).slice(0, 60) : [];
  if (!lines.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });

  const paymentMethod = clean(body.paymentMethod, 40) || "unpaid";
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: "Unknown payment method." }, { status: 400 });
  }

  const result = await priceLines(lines);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const priced = result.priced;

  if (!priced.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  const total = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const windowId = Number(body.orderWindowId) || null;
  const windowLabel = await labelForWindow(clean(body.windowLabel, 160), windowId);

  // Paid manual orders go straight into the kitchen flow; unpaid ones wait,
  // so an unpaid order is never cooked by accident.
  const status = paymentMethod === "unpaid" ? "awaiting_payment" : "new";

  const { rows } = await sql`
    INSERT INTO orders (
      customer_name, customer_email, customer_phone, customer_address,
      shabbos_label, allergies, total, items, status,
      order_window_id, payment_method, is_manual, created_by
    ) VALUES (
      ${clean(body.customerName, 160)}, ${clean(body.customerEmail, 200)},
      ${clean(body.customerPhone, 60)}, ${clean(body.customerAddress, 400)},
      ${windowLabel}, ${clean(body.notes, 1000)},
      ${total.toFixed(2)}, ${JSON.stringify(priced)}::jsonb, ${status},
      ${windowId}, ${paymentMethod}, true, 'admin'
    )
    RETURNING id, order_number;
  `;

  return NextResponse.json({ ok: true, id: rows[0].id, orderNumber: rows[0].order_number, total });
}

/**
 * An abandoned basket becomes a real order.
 *
 * A customer who wants to pay by bank transfer cannot finish on the website —
 * the basket is the only record of what she chose, and until now it could only
 * be read off a screen and retyped. Retyping thirteen dishes is where the
 * mistakes come from.
 *
 * The basket is a record of intent, not of price: lines carry product and
 * variant ids, so they are re-priced from the catalogue exactly as any other
 * order. A dish that went up since she filled the basket is charged at today's
 * price, and one that has been withdrawn is refused rather than quietly sold.
 *
 * The basket is not consumed. It is marked as ordered and pointed at the order
 * it became, so converting twice is impossible and the recovery figures still
 * count it as won.
 */
async function fromCart(body: Record<string, unknown>) {
  const cartId = clean(body.cartId, 64);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(cartId)) {
    return NextResponse.json({ error: "Unknown basket." }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT id, customer_name, customer_email, customer_phone, customer_address,
           items, notes, allergies, order_id, order_window_id, shabbos_label
    FROM abandoned_carts
    WHERE id = ${cartId}
    LIMIT 1;
  `;
  const cart = rows[0];
  if (!cart) return NextResponse.json({ error: "Basket not found." }, { status: 404 });

  // Already converted. Say which order it became rather than writing a second
  // one — a duplicate order is food cooked twice and billed twice.
  if (cart.order_id) {
    const existing = await sql`
      SELECT order_number FROM orders
      WHERE id = ${cart.order_id} AND COALESCE(is_deleted, false) = false LIMIT 1;
    `;
    if (existing.rows[0]) {
      return NextResponse.json(
        {
          error: `That basket is already order #${existing.rows[0].order_number}.`,
          orderId: Number(cart.order_id),
          orderNumber: Number(existing.rows[0].order_number),
        },
        { status: 409 },
      );
    }
    // The order it pointed at was deleted, so the basket is free again.
  }

  const items = Array.isArray(cart.items) ? (cart.items as Record<string, unknown>[]) : [];
  if (!items.length) return NextResponse.json({ error: "That basket is empty." }, { status: 400 });

  // A package has no product id, so it carries its own title and price across
  // as a custom line rather than being dropped on the floor.
  const lines: Line[] = items.map((item) =>
    item.productId
      ? {
          productId: Number(item.productId),
          variantId: item.variantId ? Number(item.variantId) : undefined,
          quantity: Number(item.quantity) || 1,
        }
      : {
          title: clean(item.title, 160),
          unitLabel: clean(item.variantLabel ?? item.unitLabel ?? "", 60),
          unitPrice: Number(item.unitPrice) || 0,
          quantity: Number(item.quantity) || 1,
        },
  );

  // Staff can correct a detail on the way through — a phone number taken down
  // wrong, a delivery note — but everything defaults to what she actually typed.
  const created = await createOrder({
    lines,
    paymentMethod: body.paymentMethod,
    customerName: body.customerName ?? cart.customer_name,
    customerEmail: body.customerEmail ?? cart.customer_email,
    customerPhone: body.customerPhone ?? cart.customer_phone,
    customerAddress: body.customerAddress ?? cart.customer_address,
    notes: body.notes ?? cart.notes ?? cart.allergies,
    orderWindowId: body.orderWindowId ?? cart.order_window_id,
    windowLabel: body.windowLabel ?? cart.shabbos_label,
  });

  if (created.status !== 200) return created;
  const order = (await created.clone().json()) as { id: number; orderNumber: number; total: number };

  // Bookkeeping only. The order exists and is the thing that matters, so a
  // failure here must not report the conversion as failed and invite a second.
  try {
    await sql`
      UPDATE abandoned_carts
      SET status = 'ordered',
          order_id = ${order.id},
          ordered_at = COALESCE(ordered_at, now()),
          reminder_stop_reason = COALESCE(reminder_stop_reason, 'converted by admin'),
          updated_at = now()
      WHERE id = ${cartId};
    `;
  } catch (error) {
    console.warn("Basket not marked as converted", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({ ok: true, ...order });
}

/**
 * Re-saving an order that already exists.
 *
 * A manual order is how a quote is recorded, and a quote changes — the customer
 * adds a kugel the day after it was written down. Retyping it as a new order
 * would hand them a second order number for the same food, so the order is
 * edited in place and its number, and the date it was first taken, are kept.
 *
 * Only manual orders. An order paid through the storefront has money attached
 * to the exact basket Stripe charged for, and editing that basket would make
 * the two disagree with no way to tell which is right.
 */
async function update(body: Record<string, unknown>) {
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Unknown order." }, { status: 400 });

  const existing = await sql`
    SELECT id, order_number, total, status, payment_method, is_manual,
           pending_payment_link, pending_payment_url
    FROM orders
    WHERE id = ${id} AND COALESCE(is_deleted, false) = false
    LIMIT 1;
  `;
  const order = existing.rows[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.is_manual) {
    return NextResponse.json(
      { error: "Only orders taken by hand can be edited. This one was paid through the website." },
      { status: 409 },
    );
  }

  const lines: Line[] = Array.isArray(body.lines) ? (body.lines as Line[]).slice(0, 60) : [];
  if (!lines.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });

  const paymentMethod = clean(body.paymentMethod, 40) || "unpaid";
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: "Unknown payment method." }, { status: 400 });
  }

  const result = await priceLines(lines);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const priced = result.priced;
  if (!priced.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });

  const total = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const windowId = Number(body.orderWindowId) || null;
  const windowLabel = await labelForWindow(clean(body.windowLabel, 160), windowId);

  // Status only moves when payment crosses the paid/unpaid line. A cook who has
  // already marked an order "ready" should not find it back at "new" because
  // someone corrected a spelling on it.
  const waiting = order.status === "awaiting_payment" || order.status === "payment_link_sent";
  const status =
    paymentMethod === "unpaid" && !waiting ? "awaiting_payment"
    : paymentMethod !== "unpaid" && waiting ? "new"
    : String(order.status);

  // An outstanding payment link is for the old total. Leaving it live is how a
  // customer pays yesterday's quote for today's order, so it is cancelled and
  // staff send a fresh one.
  const previousTotal = Number(String(order.total ?? "0").replace(/[^0-9.]/g, ""));
  const linkIsStale = Boolean(order.pending_payment_link) &&
    (Math.abs(previousTotal - total) > 0.005 || paymentMethod !== "unpaid");
  if (linkIsStale) await cancelPaymentLink(String(order.pending_payment_link));

  const fields = {
    name: clean(body.customerName, 160),
    email: clean(body.customerEmail, 200),
    phone: clean(body.customerPhone, 60),
    address: clean(body.customerAddress, 400),
    notes: clean(body.notes, 1000),
    items: JSON.stringify(priced),
    amount: total.toFixed(2),
  };

  try {
    await sql`
      UPDATE orders SET
        customer_name = ${fields.name}, customer_email = ${fields.email},
        customer_phone = ${fields.phone}, customer_address = ${fields.address},
        shabbos_label = ${windowLabel}, allergies = ${fields.notes},
        total = ${fields.amount}, items = ${fields.items}::jsonb, status = ${status},
        order_window_id = ${windowId}, payment_method = ${paymentMethod},
        pending_payment_link = CASE WHEN ${linkIsStale} THEN NULL ELSE pending_payment_link END,
        pending_payment_url = CASE WHEN ${linkIsStale} THEN NULL ELSE pending_payment_url END,
        updated_at = now(), revision = COALESCE(revision, 0) + 1
      WHERE id = ${id};
    `;
  } catch (error) {
    // Migration 0025 adds the two columns that record an edit. Without it the
    // edit itself still has to work — the trail is worth less than the order.
    if ((error as { code?: string }).code !== "42703") throw error;
    console.warn("Order revision columns missing — apply migration 0025.");
    await sql`
      UPDATE orders SET
        customer_name = ${fields.name}, customer_email = ${fields.email},
        customer_phone = ${fields.phone}, customer_address = ${fields.address},
        shabbos_label = ${windowLabel}, allergies = ${fields.notes},
        total = ${fields.amount}, items = ${fields.items}::jsonb, status = ${status},
        order_window_id = ${windowId}, payment_method = ${paymentMethod},
        pending_payment_link = CASE WHEN ${linkIsStale} THEN NULL ELSE pending_payment_link END,
        pending_payment_url = CASE WHEN ${linkIsStale} THEN NULL ELSE pending_payment_url END
      WHERE id = ${id};
    `;
  }

  const cookItems = await syncCookItems(id, priced, fields.notes);

  return NextResponse.json({
    ok: true,
    id: Number(order.id),
    orderNumber: Number(order.order_number),
    total,
    paymentLinkCancelled: linkIsStale,
    cookItemsUpdated: cookItems,
  });
}

/** Deactivates a Stripe payment link so the old total can no longer be paid. */
async function cancelPaymentLink(linkId: string) {
  if (!linkId || !process.env.STRIPE_SECRET_KEY) return;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.paymentLinks.update(linkId, { active: false });
  } catch (error) {
    // Worth knowing about, not worth refusing the edit over: the link is
    // cleared from the order either way, so staff will send a new one.
    console.warn("Could not deactivate the old payment link", error instanceof Error ? error.message : error);
  }
}

/**
 * Brings the cook planner in line with a revised order.
 *
 * Only for orders already pulled into the planner — editing an order should not
 * quietly import it. Lines keep their cook day and their completed tick where
 * they still exist, because the pan may already be in the oven; lines that were
 * removed from the order disappear unless they are already cooked.
 */
async function syncCookItems(orderId: number, priced: PricedItem[], orderNote: string) {
  try {
    const { rows } = await sql`
      SELECT source_order_label, customer_name, event_date
      FROM cook_items
      WHERE source_type = 'palate' AND source_order_id = ${String(orderId)}
      LIMIT 1;
    `;
    const planned = rows[0];
    if (!planned) return 0;

    let changed = 0;
    for (const [index, item] of priced.entries()) {
      const notes = [item.note || "", orderNote].map((part) => part.trim()).filter(Boolean).join(" · ");
      const updated = await sql`
        UPDATE cook_items
        SET item_name = ${item.title}, sold_by = ${item.soldBy}, quantity = ${item.quantity},
            notes = ${notes}, updated_at = now()
        WHERE source_type = 'palate' AND source_order_id = ${String(orderId)}
          AND source_line_key = ${String(index)} AND completed = false
        RETURNING id;
      `;
      if (updated.rowCount) { changed += updated.rowCount; continue; }
      // A dish added to the order after it was planned. ON CONFLICT covers the
      // line that was left alone because it is already cooked.
      const added = await sql`
        INSERT INTO cook_items (
          source_type, source_order_id, source_line_key, source_order_label,
          customer_name, event_date, item_name, sold_by, quantity, notes
        ) VALUES (
          'palate', ${String(orderId)}, ${String(index)}, ${planned.source_order_label},
          ${planned.customer_name}, ${planned.event_date}, ${item.title}, ${item.soldBy},
          ${item.quantity}, ${notes}
        )
        ON CONFLICT (source_type, source_order_id, source_line_key) DO NOTHING
        RETURNING id;
      `;
      changed += added.rowCount || 0;
    }

    // Lines that no longer exist on the order. An already-cooked one stays:
    // the food was made, and the planner should not pretend otherwise.
    const removed = await sql`
      DELETE FROM cook_items
      WHERE source_type = 'palate' AND source_order_id = ${String(orderId)}
        AND completed = false
        AND source_line_key::integer >= ${priced.length}
      RETURNING id;
    `;
    return changed + (removed.rowCount || 0);
  } catch (error) {
    // The planner is a separate tool; an order edit must not fail because it
    // is unavailable or its tables have not been migrated.
    console.warn("Cook planner not resynced", error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * A Stripe payment link for an existing order.
 *
 * Carries `order_id` in metadata, which is what the webhook already reads to
 * mark the order paid — the same contract the old admin used, so a link created
 * here settles exactly like one created there.
 *
 * A link can also be billed in US dollars, for customers paying with an
 * American card. The order's shekel total is not converted — staff type the
 * dollar amount they quoted, and may name the line ("Office Party") so the
 * customer recognises what they are paying for. The Stripe account is Canadian
 * and pays out in USD, so a dollar charge lands without a currency conversion.
 */
async function paymentLink(body: Record<string, unknown>) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const orderId = Number(body.orderId);
  if (!orderId) return NextResponse.json({ error: "Unknown order." }, { status: 400 });

  const { rows } = await sql`
    SELECT id, order_number, total, items, customer_email, shabbos_label, pending_payment_link
    FROM orders WHERE id = ${orderId} AND COALESCE(is_deleted,false) = false LIMIT 1;
  `;
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const currency = body.currency === "usd" ? "usd" : "ils";
  let amount: number;
  if (currency === "usd") {
    amount = Math.round(Number(String(body.amount ?? "").replace(/[^0-9.]/g, "")) * 100);
    // Stripe's floor for a dollar charge is 50 cents; the ceiling only catches
    // a slipped finger.
    if (!amount || amount < 50) return NextResponse.json({ error: "Enter the amount in dollars (at least $0.50)." }, { status: 400 });
    if (amount > 10_000_000) return NextResponse.json({ error: "That amount is too large for one link." }, { status: 400 });
  } else {
    amount = Math.round(Number(String(order.total).replace(/[^0-9.]/g, "")) * 100);
    if (!amount) return NextResponse.json({ error: "That order has no amount to charge." }, { status: 400 });
  }

  const defaultName = `Palate order #${order.order_number}${order.shabbos_label ? ` · ${order.shabbos_label}` : ""}`;
  const name = clean(body.itemName, 120) || defaultName;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const link = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency,
          unit_amount: amount,
          // One line for the order rather than itemising: the customer has
          // already agreed the total, and an itemised link invites disputes
          // about a price they were quoted differently.
          product_data: { name },
        },
        quantity: 1,
      }],
      metadata: { order_id: String(order.id), billed_currency: currency, billed_amount: (amount / 100).toFixed(2) },
      after_completion: {
        type: "redirect",
        redirect: { url: "https://www.palatecateringisrael.com/thank-you" },
      },
    });

    await sql`
      UPDATE orders
      SET pending_payment_link = ${link.id}, pending_payment_url = ${link.url},
          status = CASE WHEN status = 'awaiting_payment' THEN 'payment_link_sent' ELSE status END
      WHERE id = ${order.id};
    `;
    // Only one link per order can be live, so a customer sent a shekel link and
    // then a dollar one cannot pay both.
    if (order.pending_payment_link && order.pending_payment_link !== link.id) {
      await cancelPaymentLink(String(order.pending_payment_link));
    }
    return NextResponse.json({ ok: true, url: link.url, currency, amount: amount / 100, name });
  } catch (error) {
    console.error("Payment link failed", error);
    return NextResponse.json({ error: "That payment link could not be created." }, { status: 500 });
  }
}
