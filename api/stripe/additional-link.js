const Stripe = require('stripe');
const { sql } = require('@vercel/postgres');

const {
  STRIPE_SECRET_KEY = '',
  ADMIN_PASSWORD = '',
  PAYMENT_REDIRECT_URL = 'https://palatecateringisrael.com/'
} = process.env;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' }) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { orderId, items = [], discountDescription = '', discountAmount = 0 } = body;
  if (!orderId || !Array.isArray(items) || !items.length) {
    res.status(400).send('Need orderId and at least one item');
    return;
  }

  const normalizedDiscountDescription = (discountDescription || '').toString().trim();
  const parsedDiscount = Number(discountAmount || 0);
  const normalizedDiscountAmount = Number.isFinite(parsedDiscount) && parsedDiscount > 0 ? parsedDiscount : 0;

  const lineItems = items.map(item => {
    const unitAmount = Math.round((Number(item.price) || 0) * 100);
    return {
      price_data: {
        currency: 'ils',
        unit_amount: unitAmount,
        product_data: {
          name: item.title,
          description: item.soldBy || ''
        }
      },
      quantity: Number(item.qty || item.quantity || 1)
    };
  }).filter(line => line.price_data.unit_amount > 0 && line.quantity > 0);

  if (!lineItems.length) {
    res.status(400).send('Invalid item prices/quantities');
    return;
  }

  try {
    const { rows } = await sql`
      SELECT shabbos_label
      FROM orders
      WHERE id = ${orderId}
      LIMIT 1
    `;
    if (!rows.length) {
      res.status(404).send('Order not found');
      return;
    }

    const orderLabel = (rows[0].shabbos_label || '').toString().trim().toLowerCase();
    const manualOrder = orderLabel === 'manual payment request';

    if (normalizedDiscountAmount > 0 && !manualOrder) {
      res.status(400).send('Discounts are allowed only for manual payment request orders');
      return;
    }
    if (normalizedDiscountAmount > 0 && !normalizedDiscountDescription) {
      res.status(400).send('Discount description is required when applying a discount');
      return;
    }

    let discounts;
    if (manualOrder && normalizedDiscountAmount > 0) {
      const subtotalCents = lineItems.reduce((sum, line) => sum + (line.price_data.unit_amount * line.quantity), 0);
      const discountCents = Math.min(subtotalCents, Math.round(normalizedDiscountAmount * 100));
      if (discountCents > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: discountCents,
          currency: 'ils',
          duration: 'once',
          name: normalizedDiscountDescription
        });
        discounts = [{ coupon: coupon.id }];
      }
    }

    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      metadata: {
        order_id: String(orderId),
        discount_description: normalizedDiscountDescription,
        discount_amount: normalizedDiscountAmount ? String(normalizedDiscountAmount) : ''
      },
      discounts,
      after_completion: {
        type: 'redirect',
        redirect: { url: PAYMENT_REDIRECT_URL }
      }
    });

    await sql`
      UPDATE orders
      SET pending_payment_link = ${link.id}, pending_payment_url = ${link.url}
      WHERE id = ${orderId}
    `;

    res.status(200).json({ url: link.url, id: link.id });
  } catch (error) {
    console.error('Stripe additional link error', error);
    res.status(500).send('Unable to create payment link');
  }
};
