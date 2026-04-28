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
      html_body text,
      is_deleted boolean DEFAULT false,
      deleted_at timestamptz
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { id } = body;
  if (!id) {
    res.status(400).send('Missing order id');
    return;
  }

  try {
    await ensureOrdersTable();
    const result = await sql`
      UPDATE orders
      SET is_deleted = true,
          deleted_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!result.rows.length) {
      return res.status(404).send('Order not found');
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Order delete error', error);
    res.status(500).send('Server Error');
  }
};
