-- Migration: Add photos_with_display_date view for consistent chronological sorting
-- Created at: 2026-02-28 22:38:00

CREATE OR REPLACE VIEW public.photos_with_display_date AS
SELECT 
    *,
    COALESCE(taken_at, created_at) as display_date
FROM public.photos;

-- Grant access to the view (Supabase default for public schema)
GRANT SELECT ON public.photos_with_display_date TO anon, authenticated, service_role;
