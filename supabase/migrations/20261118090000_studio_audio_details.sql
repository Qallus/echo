-- Recording Studio: an extension field on each clip, and the voice can be
-- set or corrected on any clip (uploads and mic recordings made with an AI
-- voice elsewhere, or the person who recorded it).
alter table public.studio_audio
  add column extension text check (char_length(extension) <= 40);

grant update (name, description, kind, status, image, archived_at, ai_provider, ai_voice, extension) on public.studio_audio to authenticated;
