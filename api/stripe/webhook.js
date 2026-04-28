const Stripe = require('stripe');
const rawBody = require('raw-body');
const { sql } = require('@vercel/postgres');

const {
  STRIPE_SECRET_KEY = '',
  STRIPE_WEBHOOK_SECRET = ''
} = process.env;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' }) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!stripe) {
    res.status(500).send('Stripe not configured');
    return;
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    res.status(400).send('Webhook secret not configured');
    return;
  }

  let event;
  try {
    const buf = await rawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature failed', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const metadata = event.data?.object?.metadata || {};
    const orderId = Number(metadata.order_id || 0);
    if (orderId) {
      try {
        const { rows } = await sql`
          SELECT items FROM orders WHERE id = ${orderId}
        `;
        if (rows.length) {
          const items = Array.isArray(rows[0].items) ? rows[0].items : [];
          const updatedItems = items.map(item => {
            if (item.pending) {
              return { ...item, pending: false, paid: true };
            }
            return item;
          });
          await sql`
            UPDATE orders
            SET items = ${updatedItems}, pending_payment_link = NULL, pending_payment_url = NULL
            WHERE id = ${orderId}
          `;
        }
      } catch (err) {
        console.error('Webhook order update failed', err);
      }
    }
  }

  res.status(200).send('OK');
};

module.exports.config = { api: { bodyParser: false } };
