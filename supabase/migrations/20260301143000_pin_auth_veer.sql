-- ============================================================
-- PIN-based Authentication Setup (Dedicated Users Table: Veer)
-- ============================================================

-- 1. Create the dedicated public.users table
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    pin text NOT NULL,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. CLEAN UP OLD FOREIGN KEY CONSTRAINTS
-- This is critical to ensure user_id references our new public.users table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
        WHERE kcu.column_name = 'user_id' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN ('photos', 'albums', 'cluster_jobs', 'person_clusters')
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
    END LOOP;
END $$;

-- 3. Create the "Veer" user record
INSERT INTO public.users (id, full_name, pin)
VALUES ('00000000-0000-0000-0000-000000000001', 'Veer', '1131')
ON CONFLICT (id) DO UPDATE SET pin = '1131', full_name = 'Veer';

-- 4. Re-Add user_id with references to public.users
DO $$ 
BEGIN
    -- Photos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='photos' AND column_name='user_id') THEN
        ALTER TABLE public.photos ADD COLUMN user_id uuid REFERENCES public.users(id);
    ELSE
        ALTER TABLE public.photos ADD CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
    END IF;

    -- Albums
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='albums' AND column_name='user_id') THEN
        ALTER TABLE public.albums ADD COLUMN user_id uuid REFERENCES public.users(id);
    ELSE
        ALTER TABLE public.albums ADD CONSTRAINT albums_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
    END IF;

    -- Cluster Jobs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cluster_jobs' AND column_name='user_id') THEN
        ALTER TABLE public.cluster_jobs ADD COLUMN user_id uuid REFERENCES public.users(id);
    ELSE
        ALTER TABLE public.cluster_jobs ADD CONSTRAINT cluster_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
    END IF;

    -- Person Clusters
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='person_clusters' AND column_name='user_id') THEN
        ALTER TABLE public.person_clusters ADD COLUMN user_id uuid REFERENCES public.users(id);
    ELSE
        ALTER TABLE public.person_clusters ADD CONSTRAINT person_clusters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
    END IF;
END $$;

-- 5. ASSOCIATE ALL EXISTING DATA WITH VEER
UPDATE public.photos SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE public.albums SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE public.cluster_jobs SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE public.person_clusters SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;

-- 6. RLS Policies
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_clusters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own photos" ON public.photos;
CREATE POLICY "Users can view own photos" ON public.photos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own photos" ON public.photos;
CREATE POLICY "Users can insert own photos" ON public.photos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own photos" ON public.photos;
CREATE POLICY "Users can update own photos" ON public.photos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own photos" ON public.photos;
CREATE POLICY "Users can delete own photos" ON public.photos FOR DELETE USING (true);
