const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

async function ensureUsersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      name text,
      phone text,
      address text,
      created_at timestamptz DEFAULT now()
    );
  `;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { email, password, name = '', phone = '', address = '' } = body;
  if (!email || !password) {
    res.status(400).send('Email and password required');
    return;
  }

  try {
    await ensureUsersTable();
    const hash = await bcrypt.hash(password, 10);
    const insert = await sql`
      INSERT INTO users (email, password_hash, name, phone, address)
      VALUES (${email.toLowerCase()}, ${hash}, ${name}, ${phone}, ${address})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, name, phone, address;
    `;
    const user = insert.rows[0];
    if (!user) {
      res.status(409).send('Email already registered');
      return;
    }
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(200).json({ token, user });
  } catch (err) {
    console.error('Auth register error', err);
    res.status(500).send('Server Error');
  }
};
