const { sql } = require('@vercel/postgres');
const { requireKitchenToken } = require('../lib/kitchen-auth');
const { parseJsonBody, parsePositiveInteger, normalizeText, isHttpUrl } = require('../lib/kitchen-api-utils');
const { enqueueKitchenPrintJob, claimNextKitchenPrintJob, reportKitchenPrintJob } = require('../lib/kitchen-print-queue');
const { buildKitchenJobPdfBuffer } = require('../lib/kitchen-pdf');

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

async function handleKitchenEnqueue(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!requireKitchenToken(req, res)) return;

  let body;
  try {
    body = parseJsonBody(req);
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const fileName = normalizeText(body.file_name, { maxLength: 255 });
  const pdfUrl = normalizeText(body.pdf_url, { maxLength: 2048 });
  if (!fileName) {
    res.status(400).json({ error: 'file_name is required' });
    return;
  }
  if (!pdfUrl || !isHttpUrl(pdfUrl)) {
    res.status(400).json({ error: 'pdf_url must be an absolute http(s) URL' });
    return;
  }

  try {
    const job = await enqueueKitchenPrintJob({ fileName, pdfUrl });
    console.info('Kitchen print job enqueued via API', { jobId: job?.id || null, fileName });
    res.status(200).json({ ok: true, jobId: job?.id || null });
  } catch (err) {
    console.error('Kitchen enqueue error', err);
    res.status(500).json({ error: 'Server Error' });
  }
}

async function handleKitchenNext(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!requireKitchenToken(req, res)) return;

  try {
    const job = await claimNextKitchenPrintJob();
    if (!job) {
      console.info('Kitchen print poll: no queued jobs');
      res.status(200).json({ job: null });
      return;
    }
    console.info('Kitchen print job claimed', { jobId: job.id, fileName: job.file_name });
    res.status(200).json({
      job: {
        id: job.id,
        file_name: job.file_name,
        pdf_url: job.pdf_url
      }
    });
  } catch (err) {
    console.error('Kitchen next-job error', err);
    res.status(500).json({ error: 'Server Error' });
  }
}

async function handleKitchenReport(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!requireKitchenToken(req, res)) return;

  let body;
  try {
    body = parseJsonBody(req);
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const id = parsePositiveInteger(body.id);
  const status = normalizeText(body.status, { maxLength: 20 });
  const lastErrorInput = normalizeText(body.last_error, { maxLength: 2000, allowEmpty: true });

  if (!id) {
    res.status(400).json({ error: 'id must be a positive integer' });
    return;
  }
  if (status !== 'printed' && status !== 'failed') {
    res.status(400).json({ error: "status must be 'printed' or 'failed'" });
    return;
  }

  const lastError = status === 'failed' ? (lastErrorInput || 'Unknown print failure') : null;

  try {
    const updated = await reportKitchenPrintJob({ id, status, lastError });
    if (!updated) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    console.info('Kitchen print job reported', { jobId: id, status, hasError: Boolean(lastError) });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Kitchen report error', err);
    res.status(500).json({ error: 'Server Error' });
  }
}

async function handleKitchenJobPdf(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  if (!requireKitchenToken(req, res)) return;

  const orderId = parsePositiveInteger(req.query && req.query.orderId);
  if (!orderId) {
    res.status(400).json({ error: 'orderId must be a positive integer' });
    return;
  }

  try {
    await ensureOrdersTable();
    const result = await sql`
      SELECT id, order_number, created_at, customer_name, shabbos_label, allergies, total, items, email_body
      FROM orders
      WHERE id = ${orderId}
      LIMIT 1
    `;
    const order = result.rows[0];
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const pdfBuffer = await buildKitchenJobPdfBuffer(order);
    const fileName = `kitchen-order-${orderId}.pdf`;
    console.info('Kitchen PDF generated', { orderId });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('Kitchen job PDF error', err);
    res.status(500).json({ error: 'Server Error' });
  }
}

async function handleKitchenRoute(req, res, action) {
  if (action === 'enqueue') return handleKitchenEnqueue(req, res);
  if (action === 'next') return handleKitchenNext(req, res);
  if (action === 'report') return handleKitchenReport(req, res);
  if (action === 'job-pdf') return handleKitchenJobPdf(req, res);
  res.status(404).json({ error: 'Not Found' });
}

module.exports = async (req, res) => {
  const kitchenAction = typeof req.query?.__kitchen_action === 'string'
    ? req.query.__kitchen_action.trim()
    : '';
  if (kitchenAction) {
    await handleKitchenRoute(req, res, kitchenAction);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  let body;
  try {
    body = parseJsonBody(req);
  } catch (err) {
    res.status(400).send('Invalid JSON body');
    return;
  }

  const adminKey = req.headers['x-admin-key'] || body?.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }

  const { id, status } = body || {};
  if (!id || !status) {
    res.status(400).send('Missing id or status');
    return;
  }

  try {
    await ensureOrdersTable();
    await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Order status update error', err);
    res.status(500).send('Server Error');
  }
};
