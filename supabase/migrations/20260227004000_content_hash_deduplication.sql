-- Migration: Add content_hash for de-duplication
-- Created at: 2026-02-27 00:40:00

-- 1. Add content_hash column to photos
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS content_hash text;

-- 2. Create unique index to prevent duplicate uploads
-- We use WHERE NOT is_deleted so that if a photo is permanently deleted, 
-- the hash is freed up for re-uploading if necessary.
CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_hash ON public.photos(content_hash) WHERE NOT is_deleted;

-- 3. (Optional) Comment on the column for documentation
COMMENT ON COLUMN public.photos.content_hash IS 'SHA-256 hash of the original file content used for de-duplication.';
