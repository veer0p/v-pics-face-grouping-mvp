-- ============================================================
-- V-Pics: Schema Upgrade & Production Readiness
-- This script handles existing tables and ensures all columns exist.
-- ============================================================

DO $$ 
BEGIN
    -- 1. Create set_updated_at function if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        CREATE FUNCTION public.set_updated_at() RETURNS trigger AS '
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        ' LANGUAGE plpgsql;
    END IF;

    -- 2. Ensure public.photos table exists
    CREATE TABLE IF NOT EXISTS public.photos (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        original_key    text NOT NULL UNIQUE,
        original_name   text NOT NULL,
        mime_type       text NOT NULL,
        size_bytes      bigint NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
    );

    -- 3. Rename is_favorite to is_liked if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='is_favorite') THEN
        ALTER TABLE public.photos RENAME COLUMN is_favorite TO is_liked;
    END IF;

    -- 4. Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='is_liked') THEN
        ALTER TABLE public.photos ADD COLUMN is_liked boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='thumb_key') THEN
        ALTER TABLE public.photos ADD COLUMN thumb_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='width') THEN
        ALTER TABLE public.photos ADD COLUMN width int;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='height') THEN
        ALTER TABLE public.photos ADD COLUMN height int;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='thumb_width') THEN
        ALTER TABLE public.photos ADD COLUMN thumb_width int;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='thumb_height') THEN
        ALTER TABLE public.photos ADD COLUMN thumb_height int;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='blurhash') THEN
        ALTER TABLE public.photos ADD COLUMN blurhash text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='taken_at') THEN
        ALTER TABLE public.photos ADD COLUMN taken_at timestamptz;
    END IF;

    -- EXIF metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='camera_make') THEN
        ALTER TABLE public.photos ADD COLUMN camera_make text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='camera_model') THEN
        ALTER TABLE public.photos ADD COLUMN camera_model text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='lens_model') THEN
        ALTER TABLE public.photos ADD COLUMN lens_model text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='focal_length') THEN
        ALTER TABLE public.photos ADD COLUMN focal_length real;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='aperture') THEN
        ALTER TABLE public.photos ADD COLUMN aperture real;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='iso') THEN
        ALTER TABLE public.photos ADD COLUMN iso int;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='shutter_speed') THEN
        ALTER TABLE public.photos ADD COLUMN shutter_speed text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='gps_lat') THEN
        ALTER TABLE public.photos ADD COLUMN gps_lat double precision;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='gps_lng') THEN
        ALTER TABLE public.photos ADD COLUMN gps_lng double precision;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='orientation') THEN
        ALTER TABLE public.photos ADD COLUMN orientation int;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='exif_raw') THEN
        ALTER TABLE public.photos ADD COLUMN exif_raw jsonb;
    END IF;

    -- Soft delete tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='is_deleted') THEN
        ALTER TABLE public.photos ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='deleted_at') THEN
        ALTER TABLE public.photos ADD COLUMN deleted_at timestamptz;
    END IF;

    -- 5. Albums table
    CREATE TABLE IF NOT EXISTS public.albums (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name        text NOT NULL,
        cover_key   text,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
    );

    -- 6. Album Photos junction
    CREATE TABLE IF NOT EXISTS public.album_photos (
        album_id    uuid NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
        photo_id    uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
        position    int NOT NULL DEFAULT 0,
        added_at    timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (album_id, photo_id)
    );

END $$;

-- 7. Ensure Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_photos_updated_at') THEN
        CREATE TRIGGER trg_photos_updated_at
            BEFORE UPDATE ON public.photos
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_albums_updated_at') THEN
        CREATE TRIGGER trg_albums_updated_at
            BEFORE UPDATE ON public.albums
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- 8. Indexes (using IF NOT EXISTS is native for indexes)
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos(created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_photos_liked ON public.photos(is_liked) WHERE is_liked AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_photos_deleted ON public.photos(deleted_at) WHERE is_deleted;

-- 9. RLS
DO $$
BEGIN
    ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policies (Drop and recreate to be safe)
DROP POLICY IF EXISTS "service_all_photos" ON public.photos;
CREATE POLICY "service_all_photos" ON public.photos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_all_albums" ON public.albums;
CREATE POLICY "service_all_albums" ON public.albums FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_all_album_photos" ON public.album_photos;
CREATE POLICY "service_all_album_photos" ON public.album_photos FOR ALL USING (true) WITH CHECK (true);
