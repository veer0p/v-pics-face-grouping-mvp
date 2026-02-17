create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.cluster_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('draft', 'queued', 'processing', 'completed', 'failed')),
  config jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  error_message text null,
  worker_id text null,
  lease_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null
);

create table if not exists public.job_images (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cluster_jobs(id) on delete cascade,
  object_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  upload_state text not null default 'pending' check (upload_state in ('pending', 'uploaded', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.person_clusters (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cluster_jobs(id) on delete cascade,
  cluster_label int not null,
  display_name text null,
  face_count int not null default 0,
  preview_crop_path text null,
  created_at timestamptz not null default now(),
  unique(job_id, cluster_label)
);

create table if not exists public.detected_faces (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cluster_jobs(id) on delete cascade,
  image_id uuid not null references public.job_images(id) on delete cascade,
  cluster_id uuid null references public.person_clusters(id) on delete set null,
  face_index int not null,
  det_score real not null,
  bbox jsonb not null,
  embedding vector(512) not null,
  crop_path text null,
  created_at timestamptz not null default now(),
  unique(job_id, image_id, face_index)
);

create index if not exists idx_cluster_jobs_status_created_at
  on public.cluster_jobs(status, created_at);

create index if not exists idx_job_images_job_id_upload_state
  on public.job_images(job_id, upload_state);

create index if not exists idx_detected_faces_job_cluster
  on public.detected_faces(job_id, cluster_id);

drop trigger if exists trg_cluster_jobs_updated_at on public.cluster_jobs;
create trigger trg_cluster_jobs_updated_at
before update on public.cluster_jobs
for each row execute function public.set_updated_at();

alter table public.cluster_jobs enable row level security;
alter table public.job_images enable row level security;
alter table public.person_clusters enable row level security;
alter table public.detected_faces enable row level security;
