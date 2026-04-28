CREATE TABLE IF NOT EXISTS kitchen_print_jobs (
  id serial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'queued',
  file_name text NOT NULL,
  pdf_url text NOT NULL,
  last_error text
);

CREATE INDEX IF NOT EXISTS kitchen_print_jobs_status_created_at_idx
  ON kitchen_print_jobs (status, created_at);
