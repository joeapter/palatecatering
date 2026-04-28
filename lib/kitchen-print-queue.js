const { sql } = require('@vercel/postgres');

async function ensureKitchenPrintJobsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS kitchen_print_jobs (
      id serial PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      status text DEFAULT 'queued',
      file_name text NOT NULL,
      pdf_url text NOT NULL,
      last_error text
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS kitchen_print_jobs_status_created_at_idx
    ON kitchen_print_jobs (status, created_at);
  `;
}

async function enqueueKitchenPrintJob({ fileName, pdfUrl }) {
  await ensureKitchenPrintJobsTable();
  const result = await sql`
    INSERT INTO kitchen_print_jobs (status, file_name, pdf_url)
    VALUES ('queued', ${fileName}, ${pdfUrl})
    RETURNING id, created_at, status, file_name, pdf_url
  `;
  return result.rows[0] || null;
}

async function claimNextKitchenPrintJob() {
  await ensureKitchenPrintJobsTable();
  const result = await sql`
    WITH next_job AS (
      SELECT id
      FROM kitchen_print_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE kitchen_print_jobs AS j
    SET status = 'printing'
    FROM next_job
    WHERE j.id = next_job.id
      AND j.status = 'queued'
    RETURNING j.id, j.file_name, j.pdf_url
  `;
  return result.rows[0] || null;
}

async function reportKitchenPrintJob({ id, status, lastError }) {
  await ensureKitchenPrintJobsTable();
  const result = await sql`
    UPDATE kitchen_print_jobs
    SET status = ${status},
        last_error = ${status === 'failed' ? (lastError || null) : null}
    WHERE id = ${id}
    RETURNING id, status, last_error
  `;
  return result.rows[0] || null;
}

async function listRecentKitchenPrintJobs(limit = 20) {
  await ensureKitchenPrintJobsTable();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await sql`
    SELECT id, created_at, status, file_name, pdf_url, last_error
    FROM kitchen_print_jobs
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `;
  return result.rows || [];
}

module.exports = {
  ensureKitchenPrintJobsTable,
  enqueueKitchenPrintJob,
  claimNextKitchenPrintJob,
  reportKitchenPrintJob,
  listRecentKitchenPrintJobs
};
