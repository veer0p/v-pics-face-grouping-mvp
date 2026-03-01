-- Migration: Add smart caching hash to users table
-- ==============================================

-- 1. Add photo_hash column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_hash uuid DEFAULT gen_random_uuid();

-- 2. Create function to update photo_hash (Statement Level)
CREATE OR REPLACE FUNCTION public.update_user_photo_hash_statement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update hash for any user who had a photo touched in this statement
  -- Using transition tables (REFERENCING) to avoid per-row overhead
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE public.users SET photo_hash = gen_random_uuid(), updated_at = now()
    WHERE id IN (SELECT DISTINCT user_id FROM new_table);
  END IF;
  
  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
    UPDATE public.users SET photo_hash = gen_random_uuid(), updated_at = now()
    WHERE id IN (SELECT DISTINCT user_id FROM old_table);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Create statement-level triggers
DROP TRIGGER IF EXISTS photos_update_hash_trigger_ins ON public.photos;
CREATE TRIGGER photos_update_hash_trigger_ins
AFTER INSERT ON public.photos
REFERENCING NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION public.update_user_photo_hash_statement();

DROP TRIGGER IF EXISTS photos_update_hash_trigger_upd ON public.photos;
CREATE TRIGGER photos_update_hash_trigger_upd
AFTER UPDATE ON public.photos
REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION public.update_user_photo_hash_statement();

DROP TRIGGER IF EXISTS photos_update_hash_trigger_del ON public.photos;
CREATE TRIGGER photos_update_hash_trigger_del
AFTER DELETE ON public.photos
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT EXECUTE FUNCTION public.update_user_photo_hash_statement();

-- 4. Initial hash set for existing users
UPDATE public.users SET photo_hash = gen_random_uuid() WHERE photo_hash IS NULL;
