const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function ensureOrdersTable() {
  try {
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
  } catch (err) {
    console.error('ensureOrdersTable error', err);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const {
    customer,
    items = [],
    total = '',
    shabbosLabel = '',
    allergies = '',
    emailBody = '',
    htmlBody = '',
    pdfDataUrl = '',
    authToken = ''
  } = JSON.parse(event.body || '{}');

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASS;
  const to = process.env.ORDER_TO || '';
  const cc = process.env.ORDER_CC || '';
  const fromName = process.env.ORDER_FROM_NAME || 'Palate Catering';
  const replyTo = process.env.ORDER_REPLY_TO || customer?.email || '';

  if (!user || !pass || !to) {
    return { statusCode: 500, body: 'Email env vars missing' };
  }

  let attachment;
  if (pdfDataUrl && pdfDataUrl.startsWith('data:application/pdf')) {
    const base64 = pdfDataUrl.split(',')[1];
    attachment = {
      filename: 'palate-order.pdf',
      content: Buffer.from(base64, 'base64'),
      contentType: 'application/pdf'
    };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const safeHtmlBody = (htmlBody || '').trim();
  const safeTextBody = (emailBody || '').trim();
  const fallbackHtml = safeHtmlBody || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${safeTextBody.replace(/</g,"&lt;")}</pre>`;

  let orderNumber;
  try {
    await ensureOrdersTable();
    let userEmailFromToken = '';
    try {
      if (authToken) {
        const decoded = jwt.verify(authToken, JWT_SECRET);
        userEmailFromToken = decoded?.email || '';
      }
    } catch (err) {
      console.warn('authToken verify failed', err.message);
    }
    const insert = await sql`
      INSERT INTO orders (
        customer_name, customer_email, customer_phone, customer_address,
        shabbos_label, allergies, total, items, email_body, html_body, status
      ) VALUES (
        ${customer?.name || ''},
        ${customer?.email || userEmailFromToken || ''},
        ${customer?.phone || ''},
        ${customer?.address || ''},
        ${shabbosLabel || ''},
        ${allergies || ''},
        ${total || ''},
        ${JSON.stringify(items || [])},
        ${safeTextBody || ''},
        ${fallbackHtml || ''},
        'new'
      )
      RETURNING order_number
    `;
    orderNumber = insert?.rows?.[0]?.order_number;
  } catch (err) {
    console.error('Order save error', err);
  }

  const staffMail = {
    from: `${fromName} <${user}>`,
    to,
    cc,
    replyTo,
    subject: `Order #${orderNumber || 'NEW'} — ${shabbosLabel || 'Palate Shabbos Order'}`,
    text: safeTextBody || undefined,
    html: fallbackHtml,
    attachments: attachment ? [attachment] : []
  };

  const mails = [transporter.sendMail(staffMail)];

  if (customer && customer.email) {
    mails.push(
      transporter.sendMail({
        from: `${fromName} <${user}>`,
        to: customer.email,
        replyTo,
        subject: `Your Order #${orderNumber || ''} — ${shabbosLabel || ''}`,
        text: safeTextBody || undefined,
        html: fallbackHtml,
        attachments: attachment ? [attachment] : []
      })
    );
  }

  try {
    await Promise.all(mails);
    return { statusCode: 200, body: JSON.stringify({ ok: true, orderNumber }) };
  } catch (err) {
    console.error('Email send error', err);
    try {
      const logLine = `[${new Date().toISOString()}] EMAIL_FAIL ${err.message || err.toString()}\n`;
      const tmpPath = path.join('/tmp', 'email-fail.log');
      fs.appendFileSync(tmpPath, logLine);
    } catch {}
    return { statusCode: 500, body: 'Email failed' };
  }
};
