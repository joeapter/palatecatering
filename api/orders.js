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
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const adminKey = req.headers['x-admin-key'] || req.query.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }

  try {
    await ensureOrdersTable();
    const { rows } = await sql`
      SELECT id, order_number, created_at, status, customer_name, customer_email, customer_phone,
             customer_address, shabbos_label, allergies, total, items, html_body, email_body
      FROM orders
      ORDER BY created_at DESC
      LIMIT 300;
    `;
    res.status(200).json({ orders: rows });
  } catch (err) {
    console.error('Orders fetch error', err);
    res.status(500).send('Server Error');
  }
};
