-- ============================================================
-- Auth + Comments + Video MVP schema
-- ============================================================

create extension if not exists pgcrypto;

-- -------------------------
-- Users: username + hashed PIN
-- -------------------------
alter table public.users
  add column if not exists username text,
  add column if not exists pin_hash text,
  add column if not exists biometric_ready boolean not null default false,
  add column if not exists last_login_at timestamptz;

alter table public.users
  alter column pin drop not null;

update public.users
set username = lower(
  regexp_replace(
    coalesce(full_name, 'user') || '_' || substr(id::text, 1, 8),
    '[^a-zA-Z0-9_]+',
    '_',
    'g'
  )
)
where username is null or btrim(username) = '';

update public.users
set username = 'veer'
where id = '00000000-0000-0000-0000-000000000001'
  and (username is null or username like 'veer_%');

create unique index if not exists idx_users_username_unique
  on public.users (lower(username));

-- -------------------------
-- Auth sessions
-- -------------------------
create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text,
  ip_address text
);

create index if not exists idx_auth_sessions_user_id
  on public.auth_sessions(user_id);

create index if not exists idx_auth_sessions_expires_at
  on public.auth_sessions(expires_at);

create index if not exists idx_auth_sessions_token_hash
  on public.auth_sessions(token_hash);

-- -------------------------
-- Photos: media typing + video duration
-- -------------------------
alter table public.photos
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  add column if not exists duration_ms bigint;

update public.photos
set media_type = case
  when coalesce(mime_type, '') ilike 'video/%' then 'video'
  else 'image'
end
where media_type is null
   or media_type not in ('image', 'video');

-- -------------------------
-- Photo comments
-- -------------------------
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_photo_comments_photo_created
  on public.photo_comments(photo_id, created_at asc);

create index if not exists idx_photo_comments_user_created
  on public.photo_comments(user_id, created_at desc);

drop trigger if exists trg_photo_comments_updated_at on public.photo_comments;
create trigger trg_photo_comments_updated_at
before update on public.photo_comments
for each row execute function public.set_updated_at();

alter table public.photo_comments enable row level security;

drop policy if exists "service_all_photo_comments" on public.photo_comments;
create policy "service_all_photo_comments"
  on public.photo_comments
  for all
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'photo_comments'
  ) then
    alter publication supabase_realtime add table public.photo_comments;
  end if;
exception
  when undefined_object then
    null;
end $$;
