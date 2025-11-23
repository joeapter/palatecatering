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
  const { email, password } = body;
  if (!email || !password) {
    res.status(400).send('Email and password required');
    return;
  }

  try {
    await ensureUsersTable();
    const { rows } = await sql`SELECT id, email, password_hash, name, phone, address FROM users WHERE email = ${email.toLowerCase()}`;
    const user = rows[0];
    if (!user) {
      res.status(401).send('Invalid credentials');
      return;
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).send('Invalid credentials');
      return;
    }
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address } });
  } catch (err) {
    console.error('Auth login error', err);
    res.status(500).send('Server Error');
  }
};
