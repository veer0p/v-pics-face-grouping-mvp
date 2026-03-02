-- Migration: make deduplication unique per-user instead of globally.

DROP INDEX IF EXISTS public.idx_photos_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_user_hash
ON public.photos(user_id, content_hash)
WHERE NOT is_deleted AND content_hash IS NOT NULL;
