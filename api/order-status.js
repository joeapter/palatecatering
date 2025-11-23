const { sql } = require('@vercel/postgres');

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
      html_body text
    );
  `;
  await sql`ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('order_number_seq')`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const adminKey = req.headers['x-admin-key'] || req.body?.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }

  const { id, status } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!id || !status) {
    res.status(400).send('Missing id or status');
    return;
  }

  try {
    await ensureOrdersTable();
    await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Order status update error', err);
    res.status(500).send('Server Error');
  }
};
