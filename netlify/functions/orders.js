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

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const adminKey = event.headers['x-admin-key'] || event.queryStringParameters?.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: 'Unauthorized' };
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
    return { statusCode: 200, body: JSON.stringify({ orders: rows }) };
  } catch (err) {
    console.error('Orders fetch error', err);
    return { statusCode: 500, body: 'Server Error' };
  }
};
