-- Allow standalone photo uploads without a clustering job
ALTER TABLE public.job_images ALTER COLUMN job_id DROP NOT NULL;
