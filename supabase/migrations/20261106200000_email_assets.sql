-- Logos and images uploaded in the email template builder. Public, because
-- the images are loaded by people's email apps. Only staff who manage
-- communications can add, replace or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-assets', 'email-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "email_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'email-assets' and (select private.staff_can('comms.manage')));
create policy "email_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'email-assets' and (select private.staff_can('comms.manage')));
create policy "email_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'email-assets' and (select private.staff_can('comms.manage')));
