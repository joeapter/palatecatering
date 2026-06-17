const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { sql } = require('@vercel/postgres');
const { ensureAbandonedCartsTable, normalizeCartId } = require('../../lib/abandoned-carts');

const {
  STRIPE_SECRET_KEY = '',
  ADMIN_PASSWORD = '',
  PAYMENT_REDIRECT_URL = 'https://palatecateringisrael.com/'
} = process.env;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' }) : null;

async function ensureOrdersTable() {
  await sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1600`;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id serial PRIMARY KEY,
      order_number integer NOT NULL DEFAULT nextval('order_number_seq'),
      created_at timestamptz DEFAULT now(),
      status text DEFAULT 'new',
      customer_name text,
      customer_email text,
      customer_phone text,
      customer_address text,
      shabbos_label text,
      allergies text,
      total text,
      items jsonb,
      email_body text,
      html_body text,
      is_deleted boolean DEFAULT false,
      deleted_at timestamptz
    );
  `;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_payment_link text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pending_payment_url text`;
  await sql`ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('order_number_seq')`;
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}

function text(value, max = 500) {
  const normalized = (value ?? '').toString().trim();
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function escapeHtml(value) {
  return text(value, 2000).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function quantity(item) {
  const value = Number(item?.quantity ?? item?.qty ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function price(item) {
  const value = Number(item?.price ?? item?.unit_price ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    title: text(item?.title || item?.item || item?.name || 'Item', 240),
    item: text(item?.item || item?.title || item?.name || 'Item', 240),
    soldBy: text(item?.soldBy || item?.sold_by || item?.sold_by_label || '', 160),
    price: price(item),
    quantity: quantity(item),
    qty: quantity(item),
    key: text(item?.key || '', 180),
    pending: true,
    paid: false
  })).filter(item => item.title && item.price > 0 && item.quantity > 0);
}

function formatCurrency(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '';
  return `₪${num.toFixed(2).replace(/\.00$/, '')}`;
}

function buildLineItems(items) {
  return items.map(item => ({
    price_data: {
      currency: 'ils',
      unit_amount: Math.round(item.price * 100),
      product_data: {
        name: item.title,
        description: item.soldBy || ''
      }
    },
    quantity: item.quantity
  }));
}

async function upsertOrder(cart, items, total) {
  const existingOrderId = Number(cart.payment_link_order_id || cart.order_id || 0);
  const label = text(cart.shabbos_label || `${cart.source || 'Cart'} recovery`, 300);
  const totalText = total.toFixed(2).replace(/\.00$/, '');
  const serializedItems = JSON.stringify(items);
  if (existingOrderId) {
    const { rows } = await sql`
      UPDATE orders
      SET customer_name = ${cart.customer_name || ''},
          customer_email = ${cart.customer_email || ''},
          customer_phone = ${cart.customer_phone || ''},
          customer_address = ${cart.customer_address || ''},
          shabbos_label = ${label},
          allergies = ${cart.allergies || cart.notes || ''},
          total = ${totalText},
          items = ${serializedItems}::jsonb,
          status = 'payment_link_sent'
      WHERE id = ${existingOrderId}
      RETURNING id, order_number
    `;
    if (rows.length) return rows[0];
  }
  const { rows } = await sql`
    INSERT INTO orders (
      customer_name, customer_email, customer_phone, customer_address,
      shabbos_label, allergies, total, items, status
    ) VALUES (
      ${cart.customer_name || ''},
      ${cart.customer_email || ''},
      ${cart.customer_phone || ''},
      ${cart.customer_address || ''},
      ${label},
      ${cart.allergies || cart.notes || ''},
      ${totalText},
      ${serializedItems}::jsonb,
      'payment_link_sent'
    )
    RETURNING id, order_number
  `;
  return rows[0];
}

function emailText(cart, linkUrl, order, items, total) {
  const lines = [
    `Hi ${cart.customer_name || 'there'},`,
    '',
    'Here is the secure Stripe payment link for your Palate Catering cart:',
    linkUrl,
    ''
  ];
  if (order?.order_number) lines.push(`Order #${order.order_number}`);
  if (cart.shabbos_label) lines.push(cart.shabbos_label);
  lines.push('', 'Items:');
  items.forEach(item => {
    const soldBy = item.soldBy ? ` (${item.soldBy})` : '';
    lines.push(`- ${item.quantity} x ${item.title}${soldBy} - ${formatCurrency(item.price * item.quantity)}`);
  });
  lines.push('', `Total: ${formatCurrency(total)}`, '', 'Thank you,', 'Palate Catering');
  return lines.filter(Boolean).join('\n');
}

function emailHtml(cart, linkUrl, order, items, total) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.title)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${item.quantity}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.soldBy)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('');
  return `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h1 style="margin:0 0 8px;font-size:24px;">Palate Catering</h1>
      <p>Hi ${escapeHtml(cart.customer_name || 'there')},</p>
      <p>Here is the secure Stripe payment link for your cart.</p>
      <p><a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">Pay securely with Stripe</a></p>
      <p style="color:#475569;">${order?.order_number ? `Order #${order.order_number}` : ''}${cart.shabbos_label ? ` · ${escapeHtml(cart.shabbos_label)}` : ''}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${rows}</tbody></table>
      <p style="font-weight:700;">Total: ${formatCurrency(total)}</p>
      <p style="font-size:12px;color:#64748b;">If the button does not open, copy and paste this link: ${escapeHtml(linkUrl)}</p>
    </div>
  `;
}

async function sendEmail(cart, linkUrl, order, items, total) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASS;
  const fromName = process.env.ORDER_FROM_NAME || 'Palate Catering';
  const replyTo = process.env.ORDER_REPLY_TO || user || '';
  if (!cart.customer_email) return { sent: false, reason: 'Customer email missing' };
  if (!user || !pass) return { sent: false, reason: 'Email env vars missing' };
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });
  await transporter.sendMail({
    from: `${fromName} <${user}>`,
    to: cart.customer_email,
    replyTo,
    subject: `Payment link for your Palate order${order?.order_number ? ` #${order.order_number}` : ''}`,
    text: emailText(cart, linkUrl, order, items, total),
    html: emailHtml(cart, linkUrl, order, items, total)
  });
  return { sent: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }
  const adminKey = req.headers['x-admin-key'] || '';
  if (!ADMIN_PASSWORD || adminKey !== ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }
  if (!stripe) {
    res.status(500).send('Stripe not configured');
    return;
  }
  try {
    await ensureAbandonedCartsTable();
    await ensureOrdersTable();
    const body = parseBody(req);
    const cartId = normalizeCartId(body.cartId || body.id || '');
    const shouldEmail = body.sendEmail !== false;
    if (!cartId) {
      res.status(400).send('Missing cart id');
      return;
    }
    const { rows } = await sql`SELECT * FROM abandoned_carts WHERE id = ${cartId} LIMIT 1`;
    const cart = rows[0];
    if (!cart) {
      res.status(404).send('Cart not found');
      return;
    }
    if (['ordered', 'recovered'].includes((cart.status || '').toLowerCase())) {
      res.status(400).send('This cart is already marked ordered');
      return;
    }
    const items = normalizeItems(cart.items);
    if (!items.length) {
      res.status(400).send('Cart has no priced items');
      return;
    }
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await upsertOrder(cart, items, total);
    if (!order?.id) {
      res.status(500).send('Unable to create recovery order');
      return;
    }
    const link = await stripe.paymentLinks.create({
      line_items: buildLineItems(items),
      metadata: {
        order_id: String(order.id),
        cart_id: cartId,
        recovered_cart_id: cartId,
        source: text(cart.source || '', 80),
        recovery: 'abandoned_cart'
      },
      after_completion: {
        type: 'redirect',
        redirect: { url: PAYMENT_REDIRECT_URL }
      }
    });
    await sql`
      UPDATE orders
      SET pending_payment_link = ${link.id}, pending_payment_url = ${link.url}
      WHERE id = ${order.id}
    `;
    const { rows: updatedRows } = await sql`
      UPDATE abandoned_carts
      SET status = 'payment_link_sent',
          order_id = ${order.id},
          payment_link_order_id = ${order.id},
          payment_link_id = ${link.id},
          payment_link_url = ${link.url},
          payment_link_created_at = now(),
          updated_at = now()
      WHERE id = ${cartId}
      RETURNING *
    `;
    let email = { sent: false, reason: 'Email not requested' };
    if (shouldEmail) {
      try {
        email = await sendEmail(cart, link.url, order, items, total);
      } catch (error) {
        console.error('Cart payment link email failed', error);
        email = { sent: false, reason: error?.message || 'Email failed' };
      }
    }
    res.status(200).json({
      url: link.url,
      id: link.id,
      orderId: order.id,
      orderNumber: order.order_number,
      cart: updatedRows[0] || null,
      email
    });
  } catch (error) {
    console.error('Stripe cart link error', error);
    res.status(500).send(error?.message || 'Unable to create cart payment link');
  }
};
