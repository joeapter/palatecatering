const PDFDocument = require('pdfkit');

function formatOrderTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function pickItemField(item, keys) {
  if (!item || typeof item !== 'object') return '';
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  return '';
}

function parseItems(itemsValue) {
  if (Array.isArray(itemsValue)) return itemsValue;
  if (typeof itemsValue === 'string') {
    try {
      const parsed = JSON.parse(itemsValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTextLine(body, label) {
  if (typeof body !== 'string' || !body) return '';
  const match = body.match(new RegExp(`^${escapeRegExp(label)}:\\s*(.*)$`, 'mi'));
  return match && match[1] ? match[1].trim() : '';
}

function extractNotesFromEmailBody(emailBody) {
  return {
    notes: extractTextLine(emailBody, 'Notes'),
    deliveryNotes: extractTextLine(emailBody, 'Delivery notes')
  };
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `₪${num.toFixed(2).replace(/\.00$/, '')}`;
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
      try {
        doc.end();
      } catch {
        // ignore secondary end errors
      }
      reject(err);
    }
  });
}

function drawLabelValue(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(value || '—');
}

async function buildKitchenJobPdfBuffer(orderRow) {
  const items = parseItems(orderRow.items);
  const { notes, deliveryNotes } = extractNotesFromEmailBody(orderRow.email_body || '');
  const placedAt = formatOrderTimestamp(orderRow.created_at);

  return generatePdfBuffer((doc) => {
    doc.fillColor('#111827');
    doc.font('Helvetica-Bold').fontSize(18).text('Kitchen Prep', { align: 'center' });
    doc.moveDown(0.2);

    const headerBits = [];
    if (orderRow.order_number) headerBits.push(`Order #${orderRow.order_number}`);
    if (orderRow.shabbos_label) headerBits.push(orderRow.shabbos_label);
    if (placedAt) headerBits.push(placedAt);
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(headerBits.join(' · ') || `Order ID ${orderRow.id}`, { align: 'center' });

    doc.moveDown(0.8);
    doc.fillColor('#111827');
    doc.fontSize(12);
    doc.font('Helvetica-Bold').text('Customer');
    doc.moveDown(0.2);
    doc.fontSize(11);
    drawLabelValue(doc, 'Name', orderRow.customer_name || 'Guest');
    drawLabelValue(doc, 'Allergies / notes', orderRow.allergies || 'None');
    if (notes) drawLabelValue(doc, 'Notes', notes);
    if (deliveryNotes) drawLabelValue(doc, 'Delivery notes', deliveryNotes);
    if (orderRow.total) drawLabelValue(doc, 'Total', formatCurrency(orderRow.total) || String(orderRow.total));

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(12).text('Items');
    doc.moveDown(0.2);

    if (!items.length) {
      doc.font('Helvetica').fontSize(11).text('No items recorded.');
      return;
    }

    items.forEach((item, index) => {
      const label = pickItemField(item, ['item', 'title', 'label', 'name']) || 'Item';
      const qty = pickItemField(item, ['qty', 'quantity', 'amount', 'size']) || '1';
      const soldBy = pickItemField(item, ['soldBy', 'sold_by', 'sold_by_label']);
      const line = soldBy ? `${qty} x ${label} (${soldBy})` : `${qty} x ${label}`;

      if (doc.y > doc.page.height - 72) {
        doc.addPage();
      }
      doc.font('Helvetica').fontSize(11).fillColor('#111827').text(`${index + 1}. ${line}`);
    });

    // TODO: If kitchen-sheet fidelity needs to match the emailed attachment exactly,
    // store notes/delivery notes as first-class order columns and reuse the same PDF renderer.
  });
}

module.exports = {
  buildKitchenJobPdfBuffer
};
