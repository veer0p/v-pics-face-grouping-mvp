insert into storage.buckets (id, name, public)
values
  ('photo-originals', 'photo-originals', false),
  ('face-crops', 'face-crops', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "service_role_all_photo_originals" on storage.objects;
create policy "service_role_all_photo_originals"
on storage.objects
for all
using (
  bucket_id = 'photo-originals'
  and auth.role() = 'service_role'
)
with check (
  bucket_id = 'photo-originals'
  and auth.role() = 'service_role'
);

drop policy if exists "service_role_all_face_crops" on storage.objects;
create policy "service_role_all_face_crops"
on storage.objects
for all
using (
  bucket_id = 'face-crops'
  and auth.role() = 'service_role'
)
with check (
  bucket_id = 'face-crops'
  and auth.role() = 'service_role'
);
