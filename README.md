# Face Grouping MVP (Next.js + Supabase + Python Worker)

This repo now contains:

- `web/`: Next.js app (upload UI + job status/results pages + API routes)
- `worker/`: Python background worker for face detection, embeddings, and clustering
- `supabase/migrations/`: SQL migrations for schema, RPC functions, and storage policies
- `face_cluster.py`: standalone CLI prototype (kept for direct local experiments)

## Architecture

1. User uploads images from the web UI.
2. Next.js API creates a job and signed upload URLs in Supabase.
3. Browser uploads files directly into private `photo-originals` bucket.
4. API marks uploads complete and queues the job.
5. Python worker claims queued jobs, runs face grouping, uploads crops into `face-crops`, and writes clusters/faces into Postgres.
6. Web job page polls status and renders grouped people.

## 1) Environment

Copy `.env.example` to `.env.local` for `web` and to `.env` for worker usage:

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

## 2) Apply Supabase Migrations

Run these SQL files in order in Supabase SQL editor (or Supabase CLI if configured):

1. `supabase/migrations/20260217120000_init_face_grouping_schema.sql`
2. `supabase/migrations/20260217121000_job_rpc_functions.sql`
3. `supabase/migrations/20260217122000_storage_buckets_and_policies.sql`

## 3) Run Web App

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4) Build Everything

```bash
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Optional flags:

```bash
powershell -ExecutionPolicy Bypass -File .\build.ps1 -SkipWebInstall
powershell -ExecutionPolicy Bypass -File .\build.ps1 -SkipPyTests
```

## 5) Run Worker

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r worker/requirements.txt
python worker/main.py
```

`requirements.txt` and `worker/requirements.txt` include Python-version markers:
- Python `<3.13`: `insightface 0.7.x`
- Python `>=3.13`: `insightface 0.2.1` fallback

For one-pass debugging:

```bash
python worker/main.py --once
```

## API Endpoints (implemented)

- `POST /api/upload/init`
- `POST /api/upload/complete`
- `GET /api/jobs/:jobId`

## Important Security Note

You shared keys in chat. Rotate your Supabase `service_role` key before any production use.

## Existing CLI Prototype

The original script still works:

```bash
python face_cluster.py --input photos --output output_album
```
