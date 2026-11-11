-- Recording Studio: each person's greetings, extension prompts, phone menus
-- and other recordings (ported from Channel Cast's audio studio). Rows and
-- files are private to their owner. Files live in the private 'studio-audio'
-- bucket at <owner id>/<recording id>.<ext>.

create table public.studio_audio (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  kind text not null default 'other' check (kind in ('greeting', 'extension', 'ivr', 'hold', 'voicemail', 'other')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'live')),
  source text not null check (source in ('record', 'upload', 'ai', 'mix')),
  ai_provider text check (ai_provider in ('openai', 'xai', 'gemini')),
  ai_voice text check (char_length(ai_voice) <= 80),
  storage_path text not null unique check (char_length(storage_path) <= 300),
  mime text not null check (char_length(mime) <= 80),
  size_bytes integer not null check (size_bytes between 0 and 52428800),
  duration_seconds numeric(8, 2) check (duration_seconds >= 0),
  image text check (char_length(image) <= 400000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studio_audio_owner_created_idx on public.studio_audio (owner_id, created_at desc);

create trigger studio_audio_updated_at before update on public.studio_audio
  for each row execute function public.set_updated_at();

alter table public.studio_audio enable row level security;

revoke all on public.studio_audio from anon, authenticated;
grant select, insert, delete on public.studio_audio to authenticated;
grant update (name, description, kind, status, image, archived_at) on public.studio_audio to authenticated;

create policy "studio_audio_select" on public.studio_audio for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "studio_audio_insert" on public.studio_audio for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "studio_audio_update" on public.studio_audio for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "studio_audio_delete" on public.studio_audio for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Files: the owner reads, uploads and removes their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-audio', 'studio-audio', false, 52428800,
  array['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac'])
on conflict (id) do nothing;

create policy "studio_audio_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'studio-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "studio_audio_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'studio-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "studio_audio_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'studio-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
