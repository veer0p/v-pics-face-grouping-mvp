# Face Grouping MVP

Upload photos, process them in a background worker, and view auto-grouped people clusters (Google Photos style).

Stack:
- Next.js app for upload + result UI
- Supabase for Postgres, RPC orchestration, and Storage buckets
- Python worker for face detection, embeddings, and clustering (`insightface + DBSCAN`)

## Project Structure

- `web/`: Next.js frontend + server routes
- `worker/`: Background processing worker
- `supabase/migrations/`: SQL schema + RPC + storage policies
- `face_cluster.py`: Standalone CLI prototype (kept for local experiments)
- `build.ps1`: One-command build/test script

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- Python `>=3.10`
- Supabase project (URL, anon key, service role key)

Notes:
- On first real face-processing run, `insightface` downloads model files.
- If port `3000` is occupied locally, run Next.js on another port (example: `3001`).

## Environment Setup

1. Copy root env template:

```bash
copy .env.example .env
```

2. Create web env file (`web/.env.local`) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Required root `.env` values:

```bash
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
WORKER_ID=local-worker-1
WORKER_POLL_SECONDS=5
WORKER_LEASE_SECONDS=300
WORKER_HEARTBEAT_SECONDS=30
```

## Supabase Setup (Required)

Apply migrations in this exact order:

1. `supabase/migrations/20260217120000_init_face_grouping_schema.sql`
2. `supabase/migrations/20260217121000_job_rpc_functions.sql`
3. `supabase/migrations/20260217122000_storage_buckets_and_policies.sql`

If you skip this, worker fails with errors like:
- `Could not find the function public.rpc_claim_next_job...`

## Install Dependencies

### Web

```bash
cd web
npm install
cd ..
```

### Python (worker + prototype)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r worker/requirements.txt
pip install -r requirements.txt
```

Python compatibility notes:
- `insightface` uses version markers:
  - Python `<3.13`: `insightface 0.7.x`
  - Python `>=3.13`: `insightface 0.2.1`

## Run the MVP

### Start web app

```bash
npm --prefix web run dev
```

Open:
- `http://localhost:3000`
- or `http://localhost:3001` if started with `-- --port 3001`

### Start worker

```bash
python worker/main.py
```

Optional single-cycle run:

```bash
python worker/main.py --once
```

## Usage Flow

1. Open web UI.
2. Select up to 30 images.
3. Click `Start Grouping`.
4. UI uploads files to private Supabase bucket and queues job.
5. Worker claims job, processes faces, stores cluster results.
6. Job page auto-polls and displays people-wise grouped faces.

## API Endpoints

- `POST /api/upload/init`
- `POST /api/upload/complete`
- `GET /api/jobs/:jobId`

## Build and Verification

Run full checks:

```bash
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Optional:

```bash
powershell -ExecutionPolicy Bypass -File .\build.ps1 -SkipWebInstall
powershell -ExecutionPolicy Bypass -File .\build.ps1 -SkipPyTests
```

What it runs:
- Python compile check
- Python tests (`pytest`)
- Web lint
- Web production build

## Troubleshooting

- Worker exits with RPC missing:
  - Apply all SQL migrations to Supabase.
- Web starts but uploads fail:
  - Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `web/.env.local`.
- First processing run is slow:
  - Model download/initialization is happening.
- Port conflict on `3000`:
  - `npm --prefix web run dev -- --port 3001`.

## Security

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
- Keep buckets private (already configured by migration).
- Rotate keys if they were ever shared publicly.

## Legacy CLI Prototype

Standalone local clustering still works:

```bash
python face_cluster.py --input photos --output output_album
```
