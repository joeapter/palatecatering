const { sql } = require('@vercel/postgres');
const {
  ensureAbandonedCartsTable,
  normalizeCartId
} = require('../lib/abandoned-carts');

const PUBLIC_STATUSES = new Set(['open', 'checkout_started', 'emptied']);
const ADMIN_STATUSES = new Set(['open', 'checkout_started', 'contacted', 'payment_link_sent', 'dismissed', 'recovered']);

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }
  return req.body || {};
}

function text(value, max = 500) {
  const normalized = (value ?? '').toString().trim();
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).map((item) => {
    const line = item && typeof item === 'object' ? item : {};
    const quantity = Number(line.quantity ?? line.qty ?? 1);
    const price = Number(line.price ?? line.unit_price ?? 0);
    return {
      title: text(line.title || line.item || line.name || 'Item', 240),
      item: text(line.item || line.title || line.name || 'Item', 240),
      soldBy: text(line.soldBy || line.sold_by || line.sold_by_label || '', 160),
      price: Number.isFinite(price) ? price : 0,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      qty: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      key: text(line.key || '', 180),
      variantLabel: text(line.variantLabel || '', 180)
    };
  });
}

function getItemCount(items) {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1);
  }, 0);
}

function getCustomer(payload) {
  const customer = payload.customer && typeof payload.customer === 'object' ? payload.customer : {};
  return {
    name: text(customer.name, 240),
    email: text(customer.email, 240),
    phone: text(customer.phone, 120),
    address: text(customer.address, 500),
    deliveryType: text(customer.deliveryType, 160)
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

function withRequestContext(req, payload) {
  return {
    ...payload,
    _meta: {
      capturedAt: new Date().toISOString(),
      userAgent: text(req.headers['user-agent'] || '', 300),
      ipHint: text(getClientIp(req), 80)
    }
  };
}

function assertAdmin(req, res) {
  const adminKey = req.headers['x-admin-key'] || req.query.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return false;
  }
  return true;
}

function assertPublicWrite(req, res) {
  const expected = process.env.ORDER_API_KEY || '';
  const provided = req.headers['x-order-key'] || req.headers['x-api-key'] || '';
  if (expected && provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function fetchCartById(id) {
  const { rows } = await sql`
    SELECT id, created_at, updated_at, last_seen_at, status, source, page_url,
           customer_name, customer_email, customer_phone, customer_address, delivery_type,
           shabbos_label, allergies, notes, total, item_count, items, payload,
           order_id, ordered_at, contacted_at, dismissed_at,
           payment_link_id, payment_link_url, payment_link_order_id, payment_link_created_at, admin_notes
    FROM abandoned_carts
    WHERE id = ${id}
  `;
  return rows[0] || null;
}

async function handleGet(req, res) {
  if (!assertAdmin(req, res)) return;
  await ensureAbandonedCartsTable();

  const mode = (req.query.status || 'actionable').toString().toLowerCase();
  let rows;
  if (mode === 'all') {
    ({ rows } = await sql`
      SELECT id, created_at, updated_at, last_seen_at, status, source, page_url,
             customer_name, customer_email, customer_phone, customer_address, delivery_type,
             shabbos_label, allergies, notes, total, item_count, items, payload,
             order_id, ordered_at, contacted_at, dismissed_at,
             payment_link_id, payment_link_url, payment_link_order_id, payment_link_created_at, admin_notes
      FROM abandoned_carts
      ORDER BY last_seen_at DESC
      LIMIT 500
    `);
  } else if (mode === 'ordered') {
    ({ rows } = await sql`
      SELECT id, created_at, updated_at, last_seen_at, status, source, page_url,
             customer_name, customer_email, customer_phone, customer_address, delivery_type,
             shabbos_label, allergies, notes, total, item_count, items, payload,
             order_id, ordered_at, contacted_at, dismissed_at,
             payment_link_id, payment_link_url, payment_link_order_id, payment_link_created_at, admin_notes
      FROM abandoned_carts
      WHERE status IN ('ordered', 'recovered')
      ORDER BY ordered_at DESC NULLS LAST, last_seen_at DESC
      LIMIT 500
    `);
  } else {
    ({ rows } = await sql`
      SELECT id, created_at, updated_at, last_seen_at, status, source, page_url,
             customer_name, customer_email, customer_phone, customer_address, delivery_type,
             shabbos_label, allergies, notes, total, item_count, items, payload,
             order_id, ordered_at, contacted_at, dismissed_at,
             payment_link_id, payment_link_url, payment_link_order_id, payment_link_created_at, admin_notes
      FROM abandoned_carts
      WHERE status IN ('open', 'checkout_started', 'contacted', 'payment_link_sent')
      ORDER BY last_seen_at DESC
      LIMIT 500
    `);
  }

  res.status(200).json({ carts: rows });
}

async function handlePost(req, res) {
  if (!assertPublicWrite(req, res)) return;
  await ensureAbandonedCartsTable();

  const body = parseBody(req);
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const id = normalizeCartId(body.cartId || body.cart_id || payload.cartId || payload.cart_id);
  if (!id) {
    res.status(400).json({ error: 'cartId is required' });
    return;
  }

  const items = sanitizeItems(body.items || payload.items || []);
  const itemCount = getItemCount(items);
  const requestedStatus = text(body.status || payload.cartStatus || '', 40).toLowerCase();
  const status = PUBLIC_STATUSES.has(requestedStatus)
    ? requestedStatus
    : (itemCount > 0 ? 'open' : 'emptied');
  const normalizedStatus = itemCount > 0 && status === 'emptied' ? 'open' : status;
  const customer = getCustomer(payload);
  const source = text(body.source || payload.source || '', 120);
  const pageUrl = text(body.pageUrl || body.page_url || payload.pageUrl || '', 1000);
  const cartPayload = withRequestContext(req, {
    ...payload,
    cartId: id,
    source,
    pageUrl
  });

  const { rows } = await sql`
    INSERT INTO abandoned_carts (
      id, status, source, page_url, customer_name, customer_email, customer_phone,
      customer_address, delivery_type, shabbos_label, allergies, notes, total,
      item_count, items, payload, last_seen_at, updated_at
    ) VALUES (
      ${id},
      ${normalizedStatus},
      ${source},
      ${pageUrl},
      ${customer.name},
      ${customer.email},
      ${customer.phone},
      ${customer.address},
      ${customer.deliveryType},
      ${text(payload.shabbosLabel, 300)},
      ${text(payload.allergies, 1000)},
      ${text(payload.notes || payload.deliveryNotes, 1000)},
      ${text(payload.total, 80)},
      ${itemCount},
      ${JSON.stringify(items)}::jsonb,
      ${JSON.stringify(cartPayload)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = CASE
        WHEN abandoned_carts.status IN ('ordered', 'recovered') THEN abandoned_carts.status
        WHEN abandoned_carts.status = 'payment_link_sent'
          AND abandoned_carts.items IS NOT DISTINCT FROM EXCLUDED.items
          AND abandoned_carts.total IS NOT DISTINCT FROM EXCLUDED.total
          THEN abandoned_carts.status
        ELSE EXCLUDED.status
      END,
      source = EXCLUDED.source,
      page_url = EXCLUDED.page_url,
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone,
      customer_address = EXCLUDED.customer_address,
      delivery_type = EXCLUDED.delivery_type,
      shabbos_label = EXCLUDED.shabbos_label,
      allergies = EXCLUDED.allergies,
      notes = EXCLUDED.notes,
      total = EXCLUDED.total,
      item_count = EXCLUDED.item_count,
      items = EXCLUDED.items,
      payload = EXCLUDED.payload,
      payment_link_id = CASE
        WHEN abandoned_carts.items IS DISTINCT FROM EXCLUDED.items OR abandoned_carts.total IS DISTINCT FROM EXCLUDED.total THEN NULL
        ELSE abandoned_carts.payment_link_id
      END,
      payment_link_url = CASE
        WHEN abandoned_carts.items IS DISTINCT FROM EXCLUDED.items OR abandoned_carts.total IS DISTINCT FROM EXCLUDED.total THEN NULL
        ELSE abandoned_carts.payment_link_url
      END,
      payment_link_order_id = CASE
        WHEN abandoned_carts.items IS DISTINCT FROM EXCLUDED.items OR abandoned_carts.total IS DISTINCT FROM EXCLUDED.total THEN NULL
        ELSE abandoned_carts.payment_link_order_id
      END,
      payment_link_created_at = CASE
        WHEN abandoned_carts.items IS DISTINCT FROM EXCLUDED.items OR abandoned_carts.total IS DISTINCT FROM EXCLUDED.total THEN NULL
        ELSE abandoned_carts.payment_link_created_at
      END,
      last_seen_at = now(),
      updated_at = now()
    RETURNING id, status, last_seen_at
  `;

  res.status(200).json({ cart: rows[0] || { id, status: normalizedStatus } });
}

async function handlePatch(req, res) {
  if (!assertAdmin(req, res)) return;
  await ensureAbandonedCartsTable();

  const body = parseBody(req);
  const id = normalizeCartId(body.id || body.cartId || body.cart_id);
  const status = text(body.status, 40).toLowerCase();
  const adminNotes = text(body.adminNotes || body.admin_notes || '', 2000);
  if (!id || !ADMIN_STATUSES.has(status)) {
    res.status(400).send('Missing cart id or valid status');
    return;
  }

  if (status === 'contacted') {
    await sql`
      UPDATE abandoned_carts
      SET status = ${status}, contacted_at = now(), admin_notes = ${adminNotes}, updated_at = now()
      WHERE id = ${id}
    `;
  } else if (status === 'dismissed') {
    await sql`
      UPDATE abandoned_carts
      SET status = ${status}, dismissed_at = now(), admin_notes = ${adminNotes}, updated_at = now()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE abandoned_carts
      SET status = ${status}, admin_notes = ${adminNotes}, updated_at = now()
      WHERE id = ${id}
    `;
  }

  const cart = await fetchCartById(id);
  if (!cart) {
    res.status(404).send('Cart not found');
    return;
  }
  res.status(200).json({ cart });
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
      return;
    }
    if (req.method === 'POST') {
      await handlePost(req, res);
      return;
    }
    if (req.method === 'PATCH') {
      await handlePatch(req, res);
      return;
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('Abandoned carts API error', error);
    res.status(500).send(error?.message || 'Server Error');
  }
};
