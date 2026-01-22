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

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { id, patch } = body;
  if (!id || !patch || typeof patch !== 'object') {
    res.status(400).send('Missing id or patch');
    return;
  }

  const stringFields = ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'allergies', 'status'];

  try {
    await ensureOrdersTable();
    for (const field of stringFields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        const value = patch[field] || '';
        if (typeof value !== 'string') {
          res.status(400).send(`${field} must be a string`);
          return;
        }
        if (field === 'customer_name') {
          await sql`UPDATE orders SET customer_name = ${value} WHERE id = ${id}`;
        } else if (field === 'customer_phone') {
          await sql`UPDATE orders SET customer_phone = ${value} WHERE id = ${id}`;
        } else if (field === 'customer_email') {
          await sql`UPDATE orders SET customer_email = ${value} WHERE id = ${id}`;
        } else if (field === 'customer_address') {
          await sql`UPDATE orders SET customer_address = ${value} WHERE id = ${id}`;
        } else if (field === 'allergies') {
          await sql`UPDATE orders SET allergies = ${value} WHERE id = ${id}`;
        } else if (field === 'status') {
          await sql`UPDATE orders SET status = ${value} WHERE id = ${id}`;
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'items')) {
      if (!Array.isArray(patch.items)) {
        res.status(400).send('Items must be an array');
        return;
      }
      await sql`UPDATE orders SET items = ${patch.items} WHERE id = ${id}`;
    }

    const { rows } = await sql`
      SELECT id, order_number, created_at, status, customer_name, customer_email, customer_phone, customer_address,
        shabbos_label, allergies, total, items, html_body, email_body
      FROM orders
      WHERE id = ${id}
    `;

    if (!rows.length) {
      res.status(404).send('Order not found');
      return;
    }

    res.status(200).json({ order: rows[0] });
  } catch (error) {
    console.error('Order update error', error);
    res.status(500).send('Server Error');
  }
};
