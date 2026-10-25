# Palate Website

## Kitchen Print Queue

This repo now includes a pull-based kitchen print queue backed by Vercel Postgres (`@vercel/postgres`).

### How it works

1. `api/send-order-email.js` creates the order and kitchen PDF attachment as usual.
2. After the kitchen PDF is generated, the website inserts a row into `kitchen_print_jobs` with:
   - `status = queued`
   - `file_name = kitchen-order-<orderId>.pdf`
   - `pdf_url = <site>/api/kitchen/job-pdf?orderId=<orderId>`
3. The kitchen hub Mac polls `GET /api/kitchen/next`.
4. When a job is returned, the hub downloads `pdf_url` (send the same `x-kitchen-token` header), prints locally, then calls `POST /api/kitchen/report` with `printed` or `failed`.

### Required env vars

- `KITCHEN_QUEUE_TOKEN` (required): shared secret for `/api/kitchen/*` routes (poll/report/enqueue/job-pdf).
- `NEXT_PUBLIC_SITE_URL` (recommended): absolute site base URL used to build `pdf_url` (for example `https://example.com`).

Notes:
- If `NEXT_PUBLIC_SITE_URL` is not set, the app falls back to request host headers / `SITE_URL` / `VERCEL_URL`.
- The queue uses direct DB inserts from the order flow (no self-HTTP call).

### Migration

Apply `migrations/0003_kitchen_print_jobs.sql` to create the queue table and index.

### Test with curl

Set:

```bash
export BASE_URL="https://your-site.example.com"
export KITCHEN_QUEUE_TOKEN="replace-me"
```

Enqueue a test job:

```bash
curl -sS -X POST "$BASE_URL/api/kitchen/enqueue" \
  -H "Content-Type: application/json" \
  -H "x-kitchen-token: $KITCHEN_QUEUE_TOKEN" \
  --data '{"file_name":"test-kitchen.pdf","pdf_url":"https://example.com/test.pdf"}'
```

Claim the next queued job:

```bash
curl -sS "$BASE_URL/api/kitchen/next" \
  -H "x-kitchen-token: $KITCHEN_QUEUE_TOKEN"
```

Report job status:

```bash
curl -sS -X POST "$BASE_URL/api/kitchen/report" \
  -H "Content-Type: application/json" \
  -H "x-kitchen-token: $KITCHEN_QUEUE_TOKEN" \
  --data '{"id":1,"status":"printed"}'
```

### Debug SQL (last 20 jobs)

```sql
SELECT id, created_at, status, file_name, pdf_url, last_error
FROM kitchen_print_jobs
ORDER BY created_at DESC, id DESC
LIMIT 20;
```
