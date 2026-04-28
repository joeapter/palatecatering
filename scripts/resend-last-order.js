/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { sql } = require('@vercel/postgres');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

function loadEnvFile(filename = '.env.local') {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `₪${num.toFixed(2).replace(/\.00$/, '')}`;
}

function formatOrderTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function normalizeItemField(item, keys) {
  if (!item || typeof item !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      const value = item[key];
      if (value !== undefined && value !== null && value !== '') return value;
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

function generatePdfBuffer(render) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
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
    path.resolve(__dirname, '../assets/logo.png')
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

function renderLogo(doc) {
  const logoPath = resolveLogoPath();
  if (!logoPath) return;
  const maxWidth = 140;
  const x = (doc.page.width - maxWidth) / 2;
  const y = doc.y;
  const image = doc.openImage(logoPath);
  const imageHeight = image && image.width ? (image.height / image.width) * maxWidth : 0;
  doc.image(logoPath, x, y, { width: maxWidth });
  doc.y = y + (imageHeight || 0) + 12;
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

function drawTable(doc, { columns, rows, startX, startY, rowHeight = 22 }) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const cellPadding = 6;

  doc.save();
  doc.lineWidth(1).strokeColor('#94A3B8');
  doc.fillColor('#F1F5F9').rect(startX, startY, tableWidth, rowHeight).fill();
  doc.rect(startX, startY, tableWidth, rowHeight).stroke();

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
  let cursorY = startY + rowHeight;
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
  return { endY: cursorY, rowHeight, tableWidth, startX, columns };
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
    renderLogo(doc);
    doc.font('Helvetica-Bold').fontSize(18).text('Palate Catering', { align: 'center' });
    doc.moveDown(0.15);
    doc.font('Helvetica-Bold').fontSize(14).text(context.shabbosLabel || 'Shabbos Order', { align: 'center' });
    doc.moveDown(0.3);
    const orderLine = `Order #${context.orderNumber || 'NEW'}${placedAtText ? ` · ${placedAtText}` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(orderLine, { align: 'center' });
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Customer Details');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    doc.text(`Name: ${customer.name || 'Guest'}`);
    doc.text(`Phone: ${customer.phone || 'Not provided'}`);
    doc.text(`Email: ${customer.email || 'Not provided'}`);
    doc.text(`Address: ${customer.address || 'Pickup'}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(12).text('Items');
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
    drawTotalRow(doc, tableMeta, formatCurrency(context.total) || context.total);

    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(12).text('Notes');
    doc.moveDown(0.2);
    const notesX = doc.page.margins.left;
    const notesWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font('Helvetica').fontSize(11).text(context.allergies || 'None', notesX, doc.y, {
      align: 'left',
      width: notesWidth
    });
    if (context.notes) {
      doc.font('Helvetica-Bold').text('Notes: ', { continued: true });
      doc.font('Helvetica').text(context.notes, { align: 'left', width: notesWidth });
    }
    if (context.deliveryNotes) {
      doc.font('Helvetica-Bold').text('Delivery notes: ', { continued: true });
      doc.font('Helvetica').text(context.deliveryNotes, { align: 'left', width: notesWidth });
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
    renderLogo(doc);
    doc.font('Helvetica-Bold').fontSize(16).text('Kitchen Prep', { align: 'center' });
    doc.moveDown(0.3);
    const orderLine = `Order #${context.orderNumber || 'NEW'} · ${context.shabbosLabel || 'Shabbos'}${placedAtText ? ` · ${placedAtText}` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text(orderLine, { align: 'center' });
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(12).text('Customer');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Name: ${customer.name || 'Guest'}`);
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

    doc.font('Helvetica-Bold').fontSize(12).text('Items');
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

async function main() {
  loadEnvFile();
  const { rows } = await sql`
    SELECT *
    FROM orders
    WHERE is_deleted = false
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const order = rows[0];
  if (!order) {
    console.log('No orders found.');
    return;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASS;
  const to = process.env.ORDER_TO || '';
  const cc = process.env.ORDER_CC || '';
  const fromName = process.env.ORDER_FROM_NAME || 'Palate Catering';
  const replyTo = process.env.ORDER_REPLY_TO || order.customer_email || '';
  if (!user || !pass || !to) {
    throw new Error('Missing email env vars (GMAIL_USER, GMAIL_APP_PASS, ORDER_TO).');
  }

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  const context = {
    orderNumber: order.order_number || order.id,
    createdAt: order.created_at,
    shabbosLabel: order.shabbos_label,
    allergies: order.allergies,
    notes: order.notes,
    deliveryNotes: order.delivery_notes,
    total: order.total,
    items,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.customer_address
    }
  };

  const [orderPdf, kitchenPdf] = await Promise.all([
    buildOrderPdfBuffer(context),
    buildKitchenPdfBuffer(context)
  ]);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const subject = `Order #${context.orderNumber || 'NEW'} — ${context.shabbosLabel || 'Palate Shabbos Order'}`;
  await transporter.sendMail({
    from: `${fromName} <${user}>`,
    to,
    cc,
    replyTo,
    subject,
    text: order.email_body || undefined,
    html: order.html_body || undefined,
    attachments: [
      { filename: `palate-order-${context.orderNumber || 'NEW'}.pdf`, content: orderPdf, contentType: 'application/pdf' },
      { filename: `palate-kitchen-${context.orderNumber || 'NEW'}.pdf`, content: kitchenPdf, contentType: 'application/pdf' }
    ]
  });

  console.log('Resent:', subject);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
