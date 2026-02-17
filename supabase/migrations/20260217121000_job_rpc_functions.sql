create or replace function public.rpc_create_job(
  p_files jsonb,
  p_config jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_count int;
begin
  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'p_files must be a JSON array';
  end if;

  v_count := jsonb_array_length(p_files);
  if v_count < 1 then
    raise exception 'At least one file is required';
  end if;
  if v_count > 30 then
    raise exception 'Maximum 30 files per job';
  end if;

  insert into public.cluster_jobs(status, config)
  values ('draft', coalesce(p_config, '{}'::jsonb))
  returning id into v_job_id;

  insert into public.job_images (
    id,
    job_id,
    object_path,
    original_filename,
    mime_type,
    size_bytes,
    upload_state
  )
  select
    gen_random_uuid(),
    v_job_id,
    format(
      '%s/%s_%s_%s',
      v_job_id::text,
      lpad(e.idx::text, 4, '0'),
      gen_random_uuid()::text,
      regexp_replace(coalesce(e.item->>'name', 'image'), '[^A-Za-z0-9._-]', '_', 'g')
    ),
    coalesce(e.item->>'name', 'image'),
    coalesce(e.item->>'type', 'application/octet-stream'),
    case
      when jsonb_typeof(e.item->'size') = 'number'
      then greatest((e.item->>'size')::bigint, 0)
      else 0
    end,
    'pending'
  from jsonb_array_elements(p_files) with ordinality as e(item, idx)
  order by e.idx;

  return v_job_id;
end;
$$;

create or replace function public.rpc_mark_uploads_complete(
  p_job_id uuid,
  p_object_paths text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_object_paths is null or array_length(p_object_paths, 1) is null then
    raise exception 'p_object_paths must not be empty';
  end if;

  update public.job_images
  set upload_state = 'uploaded'
  where job_id = p_job_id
    and object_path = any(p_object_paths);
end;
$$;

create or replace function public.rpc_enqueue_job(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uploaded_count int;
begin
  select count(*)
  into v_uploaded_count
  from public.job_images
  where job_id = p_job_id
    and upload_state = 'uploaded';

  if v_uploaded_count < 1 then
    raise exception 'Cannot queue a job with zero uploaded images';
  end if;

  update public.cluster_jobs
  set
    status = 'queued',
    error_message = null,
    worker_id = null,
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id
    and status in ('draft', 'queued');

  if not found then
    raise exception 'Job is not in a queueable state';
  end if;
end;
$$;

create or replace function public.rpc_claim_next_job(
  p_worker_id text,
  p_lease_seconds int default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.cluster_jobs%rowtype;
  v_images jsonb;
begin
  select *
  into v_job
  from public.cluster_jobs
  where
    status = 'queued'
    or (status = 'processing' and lease_expires_at is not null and lease_expires_at < now())
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.cluster_jobs
  set
    status = 'processing',
    worker_id = p_worker_id,
    started_at = coalesce(started_at, now()),
    lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
    updated_at = now()
  where id = v_job.id
  returning * into v_job;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ji.id,
        'object_path', ji.object_path,
        'original_filename', ji.original_filename,
        'mime_type', ji.mime_type,
        'size_bytes', ji.size_bytes
      )
      order by ji.created_at
    ),
    '[]'::jsonb
  )
  into v_images
  from public.job_images ji
  where ji.job_id = v_job.id
    and ji.upload_state = 'uploaded';

  return jsonb_build_object(
    'job', to_jsonb(v_job),
    'images', v_images
  );
end;
$$;

create or replace function public.rpc_heartbeat_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds int default 300
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cluster_jobs
  set
    lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 30)),
    updated_at = now()
  where id = p_job_id
    and status = 'processing'
    and worker_id = p_worker_id;

  if not found then
    raise exception 'Heartbeat rejected for job % and worker %', p_job_id, p_worker_id;
  end if;
end;
$$;

create or replace function public.rpc_complete_job(
  p_job_id uuid,
  p_stats jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cluster_jobs
  set
    status = 'completed',
    stats = coalesce(p_stats, '{}'::jsonb),
    finished_at = now(),
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id
    and status = 'processing';

  if not found then
    raise exception 'Only processing jobs can be completed';
  end if;
end;
$$;

create or replace function public.rpc_fail_job(
  p_job_id uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cluster_jobs
  set
    status = 'failed',
    error_message = left(coalesce(p_error, 'Unknown error'), 1000),
    finished_at = now(),
    lease_expires_at = null,
    updated_at = now()
  where id = p_job_id
    and status in ('queued', 'processing', 'draft');
end;
$$;

create or replace function public.rpc_get_job_result(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jsonb;
  v_groups jsonb;
  v_faces jsonb;
begin
  select to_jsonb(j)
  into v_job
  from (
    select id, status, stats, error_message
    from public.cluster_jobs
    where id = p_job_id
  ) as j;

  if v_job is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cluster_id', pc.id,
        'cluster_label', pc.cluster_label,
        'face_count', pc.face_count,
        'preview_crop_path', pc.preview_crop_path
      )
      order by pc.cluster_label
    ),
    '[]'::jsonb
  )
  into v_groups
  from public.person_clusters pc
  where pc.job_id = p_job_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'face_id', df.id,
        'cluster_id', df.cluster_id,
        'cluster_label', coalesce(pc.cluster_label, -1),
        'det_score', df.det_score,
        'crop_path', df.crop_path,
        'source_image_path', ji.object_path
      )
      order by coalesce(pc.cluster_label, -1), df.face_index
    ),
    '[]'::jsonb
  )
  into v_faces
  from public.detected_faces df
  left join public.person_clusters pc on pc.id = df.cluster_id
  left join public.job_images ji on ji.id = df.image_id
  where df.job_id = p_job_id;

  return jsonb_build_object(
    'job', v_job,
    'groups', v_groups,
    'faces', v_faces
  );
end;
$$;

revoke all on function public.rpc_create_job(jsonb, jsonb) from public;
revoke all on function public.rpc_mark_uploads_complete(uuid, text[]) from public;
revoke all on function public.rpc_enqueue_job(uuid) from public;
revoke all on function public.rpc_claim_next_job(text, int) from public;
revoke all on function public.rpc_heartbeat_job(uuid, text, int) from public;
revoke all on function public.rpc_complete_job(uuid, jsonb) from public;
revoke all on function public.rpc_fail_job(uuid, text) from public;
revoke all on function public.rpc_get_job_result(uuid) from public;

grant execute on function public.rpc_create_job(jsonb, jsonb) to service_role;
grant execute on function public.rpc_mark_uploads_complete(uuid, text[]) to service_role;
grant execute on function public.rpc_enqueue_job(uuid) to service_role;
grant execute on function public.rpc_claim_next_job(text, int) to service_role;
grant execute on function public.rpc_heartbeat_job(uuid, text, int) to service_role;
grant execute on function public.rpc_complete_job(uuid, jsonb) to service_role;
grant execute on function public.rpc_fail_job(uuid, text) to service_role;
grant execute on function public.rpc_get_job_result(uuid) to service_role;
