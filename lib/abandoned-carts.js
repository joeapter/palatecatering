const { sql } = require('@vercel/postgres');

const ACTIONABLE_CART_STATUSES = ['open', 'checkout_started', 'contacted', 'payment_link_sent'];

async function ensureAbandonedCartsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS abandoned_carts (
      id text PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      last_seen_at timestamptz DEFAULT now(),
      status text DEFAULT 'open',
      source text,
      page_url text,
      customer_name text,
      customer_email text,
      customer_phone text,
      customer_address text,
      delivery_type text,
      shabbos_label text,
      allergies text,
      notes text,
      total text,
      item_count integer DEFAULT 0,
      items jsonb DEFAULT '[]'::jsonb,
      payload jsonb DEFAULT '{}'::jsonb,
      order_id integer,
      ordered_at timestamptz,
      contacted_at timestamptz,
      dismissed_at timestamptz,
      payment_link_id text,
      payment_link_url text,
      payment_link_order_id integer,
      payment_link_created_at timestamptz,
      admin_notes text
    );
  `;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now()`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS source text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS page_url text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_name text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_email text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_phone text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS customer_address text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS delivery_type text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS shabbos_label text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS allergies text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS notes text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS total text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS item_count integer DEFAULT 0`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS order_id integer`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS ordered_at timestamptz`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS contacted_at timestamptz`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS dismissed_at timestamptz`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS payment_link_id text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS payment_link_url text`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS payment_link_order_id integer`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS payment_link_created_at timestamptz`;
  await sql`ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS admin_notes text`;
  await sql`
    CREATE INDEX IF NOT EXISTS abandoned_carts_status_last_seen_idx
    ON abandoned_carts (status, last_seen_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS abandoned_carts_contact_idx
    ON abandoned_carts (customer_email, customer_phone);
  `;
}

function normalizeCartId(value) {
  const text = (value || '').toString().trim();
  if (!text || text.length > 96 || !/^[a-zA-Z0-9_-]+$/.test(text)) {
    return '';
  }
  return text;
}

async function markCartOrdered(cartId, orderId = null) {
  const id = normalizeCartId(cartId);
  if (!id) return null;
  await ensureAbandonedCartsTable();
  const { rows } = await sql`
    UPDATE abandoned_carts
    SET status = 'ordered',
        order_id = ${orderId || null},
        ordered_at = now(),
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] || null;
}

module.exports = {
  ACTIONABLE_CART_STATUSES,
  ensureAbandonedCartsTable,
  markCartOrdered,
  normalizeCartId
};
