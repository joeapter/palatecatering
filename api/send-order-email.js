const nodemailer = require('nodemailer');
const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');
const { enqueueKitchenPrintJob } = require('../lib/kitchen-print-queue');
const { getSiteBaseUrl } = require('../lib/kitchen-auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' }) : null;

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
        html_body text,
        is_deleted boolean DEFAULT false,
        deleted_at timestamptz
      );
    `;
    await sql`ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('order_number_seq')`;
  } catch (err) {
    console.error('ensureOrdersTable error', err);
  }
}

function formatOrderTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return value.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function normalizeItemField(item, keys) {
  if (!item || typeof item !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      const value = item[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }
  return '';
}

function getItemLabel(item) {
  return normalizeItemField(item, ['item', 'title', 'label', 'name']);
}

function getItemQuantity(item) {
  return normalizeItemField(item, ['qty', 'quantity', 'amount', 'size']);
}

function getItemSoldBy(item) {
  return normalizeItemField(item, ['soldBy', 'sold_by', 'sold_by_label']);
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `₪${num.toFixed(2).replace(/\.00$/, '')}`;
}

async function getCardholderNameFromPaymentIntent(paymentIntentId = '') {
  const intentId = typeof paymentIntentId === 'string' ? paymentIntentId.trim() : '';
  if (!intentId || !stripe) return '';
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ['latest_charge']
    });
    const latestCharge = paymentIntent?.latest_charge && typeof paymentIntent.latest_charge === 'object'
      ? paymentIntent.latest_charge
      : null;
    return (
      latestCharge?.billing_details?.name ||
      paymentIntent?.shipping?.name ||
      ''
    ).trim();
  } catch (err) {
    console.warn('Stripe payment intent lookup failed', err?.message || err);
    return '';
  }
}

function buildOrderItemsHtml(items = []) {
  if (!items.length) {
    return `<tr><td colspan="4" style="text-align:center;padding:0.35rem 0;">No items recorded.</td></tr>`;
  }
  return items
    .map(item => {
      const label = escapeHtml(getItemLabel(item) || 'Item');
      const qty = escapeHtml(getItemQuantity(item) || '');
      const soldBy = escapeHtml(getItemSoldBy(item) || '');
      const price = escapeHtml(formatCurrency(item.price) || '');
      return `
        <tr>
          <td>${label}</td>
          <td>${qty}</td>
          <td>${soldBy}</td>
          <td>${price}</td>
        </tr>`;
    })
    .join('');
}

function buildOrderSummaryHtml({ customer = {}, items = [], total, shabbosLabel, allergies, notes, deliveryNotes, orderNumber, createdAt }) {
  const name = escapeHtml(customer?.name || 'Guest');
  const phone = escapeHtml(customer?.phone || 'Not provided');
  const email = escapeHtml(customer?.email || 'Not provided');
  const address = escapeHtml(customer?.address || '');
  const label = escapeHtml(shabbosLabel || 'Shabbos Order');
  const allergyText = escapeHtml(allergies || 'None');
  const notesText = escapeHtml(notes || '');
  const deliveryText = escapeHtml(deliveryNotes || '');
  const totalValue = escapeHtml(formatCurrency(total) || total || '');
  const tableRows = buildOrderItemsHtml(items);
  const placedAtText = formatOrderTimestamp(createdAt);
  const orderNumberLine = orderNumber ? `<p style="margin:0;color:#475569;">Order #: ${escapeHtml(orderNumber)}</p>` : '';
  const placedLine = placedAtText ? `<p style="margin:0;color:#475569;">Placed: ${escapeHtml(placedAtText)}</p>` : '';
  const attachmentNote = '<p style="margin-top:0.75rem;font-size:0.75rem;color:#475569;">Kitchen sheet attached for the team.</p>';
  return `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h1 style="margin-bottom:0.15rem;font-size:26px;text-transform:uppercase;letter-spacing:0.1em;">Palate Catering</h1>
      <h2 style="margin-top:0;margin-bottom:0.5rem;font-size:18px;text-transform:uppercase;letter-spacing:0.08em;">${label}</h2>
      ${orderNumberLine}
      ${placedLine}
      <p style="margin:0;color:#475569;">Name: ${name}</p>
      <p style="margin:0;color:#475569;">Phone: ${phone}</p>
      <p style="margin:0;color:#475569;">Email: ${email}</p>
      ${address ? `<p style="margin:0;color:#475569;">Address: ${address}</p>` : ''}
      <p style="margin-top:0.75rem;margin-bottom:0.25rem;font-weight:600;">Items</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:0.5rem;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0.35rem 0;font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">Item</th>
            <th style="text-align:left;padding:0.35rem 0;font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">Qty</th>
            <th style="text-align:left;padding:0.35rem 0;font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">Sold By</th>
            <th style="text-align:left;padding:0.35rem 0;font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#475569;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <p style="margin:0;"><strong>Allergies / notes:</strong> ${allergyText}</p>
      ${notesText ? `<p style="margin:0;"><strong>Notes:</strong> ${notesText}</p>` : ''}
      ${deliveryText ? `<p style="margin:0;"><strong>Delivery notes:</strong> ${deliveryText}</p>` : ''}
      ${totalValue ? `<p style="margin-top:0.5rem;font-weight:600;">Total: ${totalValue}</p>` : ''}
      ${attachmentNote}
    </div>`;
}

function buildOrderSummaryText({ customer = {}, items = [], total, shabbosLabel, allergies, notes, deliveryNotes, orderNumber, createdAt }) {
  const lines = [];
  lines.push(`Palate Catering — ${shabbosLabel || 'Shabbos Order'}`);
  if (orderNumber) {
    lines.push(`Order #: ${orderNumber}`);
  }
  const placedAtText = formatOrderTimestamp(createdAt);
  if (placedAtText) {
    lines.push(`Placed: ${placedAtText}`);
  }
  if (customer?.name) lines.push(`Name: ${customer.name}`);
  if (customer?.phone) lines.push(`Phone: ${customer.phone}`);
  if (customer?.email) lines.push(`Email: ${customer.email}`);
  if (customer?.address) lines.push(`Address: ${customer.address}`);
  lines.push('');
  lines.push('Items:');
  if (!items.length) {
    lines.push('- No items recorded.');
  } else {
    items.forEach(item => {
      const label = getItemLabel(item) || 'Item';
      const qty = getItemQuantity(item) || '1';
      const soldBy = getItemSoldBy(item);
      const price = formatCurrency(item.price);
      const parts = [`${qty} x ${label}`];
      if (soldBy) parts.push(`Sold by ${soldBy}`);
      if (price) parts.push(`Price ${price}`);
      lines.push(`- ${parts.join(' · ')}`);
    });
  }
  lines.push('');
  lines.push(`Allergies / notes: ${allergies || 'None'}`);
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }
  if (deliveryNotes) {
    lines.push(`Delivery notes: ${deliveryNotes}`);
  }
  if (total) {
    lines.push(`Total: ${formatCurrency(total) || total}`);
  }
  lines.push('Kitchen sheet attached for the team.');
  return lines.join('\n');
}

function buildEmailBodies(context, overrides = {}) {
  const htmlCandidate = (overrides.htmlBodyOverride || '').trim();
  const textCandidate = (overrides.textBodyOverride || '').trim();
  return {
    html: htmlCandidate || buildOrderSummaryHtml(context),
    text: textCandidate || buildOrderSummaryText(context)
  };
}

function generatePdfBuffer(render) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    try {
      render(doc);
      doc.end();
    } catch (err) {
      doc.end();
      reject(err);
    }
  });
}

function resolveLogoPath() {
  const candidates = [
    path.join(process.cwd(), 'assets', 'logo.png'),
    path.resolve(__dirname, '../assets/logo.png'),
    path.resolve(__dirname, '..', 'assets', 'logo.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function resolveUnicodeFontPath() {
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'),
    path.resolve(__dirname, '../assets/fonts/NotoSans-Regular.ttf'),
    path.resolve(__dirname, '../assets/fonts/DejaVuSans.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode MS.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/Library/Fonts/Arial Unicode MS.ttf'
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function applyPdfFont(doc) {
  const fontPath = resolveUnicodeFontPath();
  if (!fontPath) return 'Helvetica';
  try {
    doc.registerFont('Unicode', fontPath);
    doc.font('Unicode');
    return 'Unicode';
  } catch (err) {
    console.warn('Unicode font load failed', err.message);
    doc.font('Helvetica');
    return 'Helvetica';
  }
}

function drawSectionTitle(doc, title, y) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title, 36, y);
  return doc.y;
}

function drawKeyValue(doc, label, value) {
  const safeValue = value || '—';
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(safeValue);
}

function truncateText(doc, text, width) {
  if (!text) return '';
  if (doc.widthOfString(text) <= width) return text;
  const suffix = '...';
  let trimmed = text;
  while (trimmed.length && doc.widthOfString(`${trimmed}${suffix}`) > width) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${suffix}` : '';
}

function getBaseUrlFromEnv() {
  const raw = process.env.LOGO_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.SITE_URL || process.env.VERCEL_URL || '';
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

async function loadLogoBuffer() {
  const logoPath = resolveLogoPath();
  if (logoPath) {
    try {
      return fs.readFileSync(logoPath);
    } catch (err) {
      console.warn('Logo read failed', err.message);
    }
  }
  const baseUrl = getBaseUrlFromEnv();
  if (!baseUrl || typeof fetch !== 'function') return null;
  const logoUrl = `${baseUrl}/assets/logo.png`;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn('Logo fetch failed', err.message);
    return null;
  }
}

function renderLogo(doc, logoBuffer) {
  if (!logoBuffer) return 0;
  try {
    const maxWidth = 140;
    const imageWidth = maxWidth;
    const x = (doc.page.width - imageWidth) / 2;
    const y = doc.y;
    const image = doc.openImage(logoBuffer);
    const imageHeight = image && image.width ? (image.height / image.width) * imageWidth : 0;
    doc.image(logoBuffer, x, y, { width: imageWidth });
    doc.y = y + (imageHeight || 0) + 12;
    return imageWidth;
  } catch (err) {
    console.warn('Logo render failed', err.message);
    return 0;
  }
}

function drawTable(doc, { columns, rows, startX, startY, rowHeight = 22 }) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const headerHeight = rowHeight;
  const cellPadding = 6;

  doc.save();
  doc.lineWidth(1).strokeColor('#94A3B8');
  doc.fillColor('#F1F5F9').rect(startX, startY, tableWidth, headerHeight).fill();
  doc.rect(startX, startY, tableWidth, headerHeight).stroke();

  let cursorX = startX;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569');
  columns.forEach((col) => {
    doc.text(col.header, cursorX + cellPadding, startY + 6, {
      width: col.width - cellPadding * 2,
      align: col.align || 'left',
      lineBreak: false
    });
    cursorX += col.width;
  });

  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  let cursorY = startY + headerHeight;
  rows.forEach((row, index) => {
    if (index % 2 === 1) {
      doc.fillColor('#F8FAFC').rect(startX, cursorY, tableWidth, rowHeight).fill();
    }
    doc.strokeColor('#CBD5E1').rect(startX, cursorY, tableWidth, rowHeight).stroke();
    cursorX = startX;
    columns.forEach((col) => {
      const raw = row[col.key] || '';
      const clipped = col.noTruncate ? raw : truncateText(doc, raw, col.width - cellPadding * 2);
      doc.fillColor('#111827').text(clipped, cursorX + cellPadding, cursorY + 6, {
        width: col.width - cellPadding * 2,
        align: col.align || 'left',
        lineBreak: false
      });
      cursorX += col.width;
    });
    cursorY += rowHeight;
  });

  const tableBottom = cursorY;
  let lineX = startX;
  doc.strokeColor('#CBD5E1');
  for (let i = 0; i < columns.length - 1; i += 1) {
    lineX += columns[i].width;
    doc.moveTo(lineX, startY).lineTo(lineX, tableBottom).stroke();
  }

  doc.restore();
  doc.y = cursorY + 8;
  return { endY: cursorY, rowHeight, tableWidth, startX, columns, startY };
}

function drawTotalRow(doc, tableMeta, totalText) {
  if (!tableMeta) return;
  const { endY, rowHeight, tableWidth, startX, columns } = tableMeta;
  const labelWidth = columns.slice(0, -1).reduce((sum, col) => sum + col.width, 0);
  const valueWidth = columns[columns.length - 1].width;
  const cellPadding = 6;

  doc.save();
  doc.lineWidth(1).strokeColor('#94A3B8');
  doc.fillColor('#F8FAFC').rect(startX, endY, tableWidth, rowHeight).fill();
  doc.rect(startX, endY, tableWidth, rowHeight).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
  doc.text('Total', startX + cellPadding, endY + 6, {
    width: labelWidth - cellPadding * 2,
    align: 'right',
    lineBreak: false
  });
  doc.text(totalText || '—', startX + labelWidth + cellPadding, endY + 6, {
    width: valueWidth - cellPadding * 2,
    align: 'right',
    lineBreak: false
  });
  doc.restore();
  doc.y = endY + rowHeight + 8;
}

async function buildOrderPdfBuffer(context) {
  const items = Array.isArray(context.items) ? context.items : [];
  const customer = context.customer || {};
  const placedAtText = formatOrderTimestamp(context.createdAt);
  return generatePdfBuffer((doc) => {
    applyPdfFont(doc);
    doc.fillColor('#111827');
    renderLogo(doc, context.logoBuffer);
    doc.font('Helvetica-Bold').fontSize(18).text('Palate Catering', { align: 'center' });
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').fontSize(14).text(context.shabbosLabel || 'Shabbos Order', { align: 'center' });
    doc.moveDown(0.3);
    const orderLine = `Order #${context.orderNumber || 'NEW'}${placedAtText ? ` · ${placedAtText}` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(orderLine, { align: 'center' });
    doc.moveDown(0.6);

    drawSectionTitle(doc, 'Customer Details', doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    drawKeyValue(doc, 'Name', customer.name || 'Guest');
    drawKeyValue(doc, 'Phone', customer.phone || 'Not provided');
    drawKeyValue(doc, 'Email', customer.email || 'Not provided');
    drawKeyValue(doc, 'Address', customer.address || 'Pickup');
    doc.moveDown(0.6);

    drawSectionTitle(doc, 'Items', doc.y);
    doc.moveDown(0.3);
    const tableX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = [
      { header: 'Item', key: 'label', width: tableWidth * 0.44 },
      { header: 'Qty', key: 'qty', width: tableWidth * 0.14, align: 'center', noTruncate: true },
      { header: 'Sold By', key: 'soldBy', width: tableWidth * 0.22 },
      { header: 'Price', key: 'price', width: tableWidth * 0.2, align: 'right', noTruncate: true }
    ];
    const rows = items.length
      ? items.map((item) => ({
          label: getItemLabel(item) || 'Item',
          qty: getItemQuantity(item) || '1',
          soldBy: getItemSoldBy(item) || '',
          price: formatCurrency(item.price) || item.price || ''
        }))
      : [{ label: 'No items recorded.', qty: '', soldBy: '', price: '' }];
    const tableMeta = drawTable(doc, { columns, rows, startX: tableX, startY: doc.y });
    if (context.total) {
      drawTotalRow(doc, tableMeta, formatCurrency(context.total) || context.total);
    }

    doc.moveDown(0.4);
    drawSectionTitle(doc, 'Notes', doc.y);
    doc.moveDown(0.2);
    const notesX = doc.page.margins.left;
    const notesWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font('Helvetica').fontSize(11).fillColor('#111827')
      .text(context.allergies || 'None', notesX, doc.y, { align: 'left', width: notesWidth });
    if (context.notes) {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').text('Notes: ', { continued: true });
      doc.font('Helvetica').text(context.notes, { align: 'left', width: notesWidth });
    }
    if (context.deliveryNotes) {
      doc.font('Helvetica-Bold').text('Delivery notes: ', { continued: true });
      doc.font('Helvetica').text(context.deliveryNotes, { align: 'left', width: notesWidth });
    }
    if (context.total && (!tableMeta || !tableMeta.endY)) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').text(`Total: ${formatCurrency(context.total) || context.total}`);
    }
  });
}

async function buildKitchenPdfBuffer(context) {
  const items = Array.isArray(context.items) ? context.items : [];
  const customer = context.customer || {};
  const placedAtText = formatOrderTimestamp(context.createdAt);
  return generatePdfBuffer((doc) => {
    applyPdfFont(doc);
    doc.fillColor('#111827');
    renderLogo(doc, context.logoBuffer);
    doc.font('Helvetica-Bold').fontSize(16).text('Kitchen Prep', { align: 'center' });
    doc.moveDown(0.3);
    const orderLine = `Order #${context.orderNumber || 'NEW'} · ${context.shabbosLabel || 'Shabbos'}${placedAtText ? ` · ${placedAtText}` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(orderLine, { align: 'center' });
    doc.moveDown(0.6);

    drawSectionTitle(doc, 'Customer', doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    drawKeyValue(doc, 'Name', customer.name || 'Guest');
    const notesX = doc.page.margins.left;
    const notesWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font('Helvetica-Bold').text('Allergies / notes: ', { continued: true });
    doc.font('Helvetica').text(context.allergies || 'None', { align: 'left', width: notesWidth });
    if (context.notes) {
      doc.font('Helvetica-Bold').text('Notes: ', { continued: true });
      doc.font('Helvetica').text(context.notes, { align: 'left', width: notesWidth });
    }
    if (context.deliveryNotes) {
      doc.font('Helvetica-Bold').text('Delivery notes: ', { continued: true });
      doc.font('Helvetica').text(context.deliveryNotes, { align: 'left', width: notesWidth });
    }
    doc.moveDown(0.6);

    drawSectionTitle(doc, 'Items', doc.y);
    doc.moveDown(0.3);
    const tableX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columns = [
      { header: 'Item', key: 'label', width: tableWidth * 0.56 },
      { header: 'Qty', key: 'qty', width: tableWidth * 0.18, align: 'center', noTruncate: true },
      { header: 'Sold By', key: 'soldBy', width: tableWidth * 0.26 }
    ];
    const rows = items.length
      ? items.map((item) => ({
          label: getItemLabel(item) || 'Item',
          qty: getItemQuantity(item) || '1',
          soldBy: getItemSoldBy(item) || ''
        }))
      : [{ label: 'No items recorded.', qty: '', soldBy: '' }];
    drawTable(doc, { columns, rows, startX: tableX, startY: doc.y });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const {
    customer,
    items = [],
    total = '',
    shabbosLabel = '',
    allergies = '',
    notes = '',
    deliveryNotes = '',
    emailBody = '',
    htmlBody = '',
    pdfDataUrl = '',
    authToken = '',
    paymentIntentId = ''
  } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASS;
  const to = process.env.ORDER_TO || '';
  const cc = process.env.ORDER_CC || '';
  const fromName = process.env.ORDER_FROM_NAME || 'Palate Catering';
  const replyTo = process.env.ORDER_REPLY_TO || customer?.email || '';

  if (!user || !pass || !to) {
    res.status(500).send('Email env vars missing');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const normalizedCustomer = customer && typeof customer === 'object' ? { ...customer } : {};
  normalizedCustomer.name = (normalizedCustomer.name || '').trim();
  if (!normalizedCustomer.name && paymentIntentId) {
    const cardholderName = await getCardholderNameFromPaymentIntent(paymentIntentId);
    if (cardholderName) {
      normalizedCustomer.name = cardholderName;
    }
  }

  const createdAt = new Date().toISOString();
  const summaryContextBase = {
    customer: normalizedCustomer,
    items,
    total,
    shabbosLabel,
    allergies,
    notes,
    deliveryNotes,
    createdAt
  };
  let orderId = null;
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
        ${normalizedCustomer?.name || ''},
        ${normalizedCustomer?.email || userEmailFromToken || ''},
        ${normalizedCustomer?.phone || ''},
        ${normalizedCustomer?.address || ''},
        ${shabbosLabel || ''},
        ${allergies || ''},
        ${total || ''},
        ${JSON.stringify(items || [])},
        ${emailBody || ''},
        ${htmlBody || ''},
        'new'
      )
      RETURNING id, order_number
    `;
    orderId = insert?.rows?.[0]?.id || null;
    orderNumber = insert?.rows?.[0]?.order_number;
  } catch (err) {
    console.error('Order save error', err);
  }

  const logoBuffer = await loadLogoBuffer();
  const emailContext = { ...summaryContextBase, orderNumber, logoBuffer };
  const { html: htmlBodyContent, text: textBodyContent } = buildEmailBodies(emailContext, {
    htmlBodyOverride: htmlBody,
    textBodyOverride: emailBody
  });

  if (orderId) {
    try {
      await sql`
        UPDATE orders
        SET email_body = ${textBodyContent || ''}, html_body = ${htmlBodyContent || ''}
        WHERE id = ${orderId}
      `;
    } catch (err) {
      console.error('Order email content update failed', err);
    }
  }

  let customPdfAttachment;
  if (pdfDataUrl && typeof pdfDataUrl === 'string' && pdfDataUrl.startsWith('data:application/pdf')) {
    const base64 = pdfDataUrl.split(',')[1];
    customPdfAttachment = {
      filename: 'palate-order-client.pdf',
      content: Buffer.from(base64, 'base64'),
      contentType: 'application/pdf'
    };
  }

  const orderIdLabel = orderNumber || 'NEW';
  let orderPdfAttachment;
  try {
    const orderPdfBuffer = await buildOrderPdfBuffer(emailContext);
    orderPdfAttachment = {
      filename: `palate-order-${orderIdLabel}.pdf`,
      content: orderPdfBuffer,
      contentType: 'application/pdf'
    };
  } catch (err) {
    console.error('Order PDF generation failed', err);
  }

  let kitchenPdfAttachment;
  try {
    const kitchenPdfBuffer = await buildKitchenPdfBuffer(emailContext);
    kitchenPdfAttachment = {
      filename: `palate-kitchen-${orderIdLabel}.pdf`,
      content: kitchenPdfBuffer,
      contentType: 'application/pdf'
    };
  } catch (err) {
    console.error('Kitchen PDF generation failed', err);
  }

  if (orderId && kitchenPdfAttachment) {
    try {
      const baseUrl = getSiteBaseUrl(req);
      if (!baseUrl) {
        console.warn('Kitchen print queue skipped: unable to resolve site base URL', { orderId });
      } else {
        const pdfUrl = `${baseUrl}/api/kitchen/job-pdf?orderId=${encodeURIComponent(orderId)}`;
        const queuedJob = await enqueueKitchenPrintJob({
          fileName: `kitchen-order-${orderId}.pdf`,
          pdfUrl
        });
        console.info('Kitchen print job enqueued from order flow', {
          orderId,
          jobId: queuedJob?.id || null
        });
      }
    } catch (err) {
      console.error('Kitchen print job enqueue failed', err);
    }
  }

  const staffAttachments = [];
  const customerAttachments = [];
  if (orderPdfAttachment) {
    staffAttachments.push(orderPdfAttachment);
    customerAttachments.push(orderPdfAttachment);
  }
  if (kitchenPdfAttachment) {
    staffAttachments.push(kitchenPdfAttachment);
  }
  if (customPdfAttachment && !orderPdfAttachment) {
    staffAttachments.push(customPdfAttachment);
    customerAttachments.push(customPdfAttachment);
  }

  const staffMail = {
    from: `${fromName} <${user}>`,
    to,
    cc,
    replyTo,
    subject: `Order #${orderNumber || 'NEW'} — ${shabbosLabel || 'Palate Shabbos Order'}`,
    text: textBodyContent || undefined,
    html: htmlBodyContent,
    attachments: staffAttachments.length ? staffAttachments : undefined
  };

  const mails = [transporter.sendMail(staffMail)];

  if (normalizedCustomer && normalizedCustomer.email) {
    mails.push(
      transporter.sendMail({
        from: `${fromName} <${user}>`,
        to: normalizedCustomer.email,
        replyTo,
        subject: `Your Order #${orderNumber || ''} — ${shabbosLabel || ''}`,
        text: textBodyContent || undefined,
        html: htmlBodyContent,
        attachments: customerAttachments.length ? customerAttachments : undefined
      })
    );
  }

  try {
    await Promise.all(mails);
    res.status(200).json({ ok: true, orderNumber });
  } catch (err) {
    console.error('Email send error', err);
    res.status(500).send('Email failed');
  }
};
