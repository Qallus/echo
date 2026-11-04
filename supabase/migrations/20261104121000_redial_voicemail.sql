-- Redial voicemails: private bucket, path <owner id>/<call id>.mp3. Written
-- only by the signed Twilio recording webhook; the line owner can play them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('redial-voicemail', 'redial-voicemail', false, 52428800, array['audio/mpeg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;
create policy "redial_voicemail_select" on storage.objects for select to authenticated
  using (bucket_id = 'redial-voicemail' and (storage.foldername(name))[1] = (select auth.uid())::text);
