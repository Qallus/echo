-- Shared recordings show speaker names only: the speakers map also holds
-- each person's email and user id, which a public link mustn't reveal.
create or replace function private.recording_bundle(rec uuid, p_summary boolean, p_transcript boolean, p_highlights boolean, p_audio boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'title', r.title, 'created_at', r.created_at, 'duration_sec', r.duration_sec, 'source', r.source,
    'speakers', coalesce((
      select jsonb_object_agg(k, jsonb_build_object('name', v->>'name'))
      from jsonb_each(case when jsonb_typeof(r.speakers) = 'object' then r.speakers else '{}'::jsonb end) as e(k, v)
      where jsonb_typeof(v) = 'object' and coalesce(v->>'name', '') <> ''), '{}'::jsonb),
    'owner', (select p.full_name from public.profiles p where p.id = r.created_by),
    'audio_path', case when p_audio then r.storage_path end,
    'summary', case when p_summary then (
      select jsonb_build_object('title', s.title, 'overview', s.overview, 'key_points', s.key_points, 'sections', s.sections)
      from public.summaries s where s.recording_id = r.id) end,
    'action_items', case when p_summary then coalesce((
      select jsonb_agg(jsonb_build_object('owner', a.owner_name, 'text', a.text, 'done', a.done) order by a.position)
      from public.action_items a where a.recording_id = r.id), '[]'::jsonb) end,
    'highlights', case when p_highlights then coalesce((
      select jsonb_agg(jsonb_build_object('start_sec', h.start_sec, 'text', h.text, 'kind', h.kind, 'title', h.title) order by h.start_sec)
      from public.highlights h where h.recording_id = r.id), '[]'::jsonb) end,
    'segments', case when p_transcript then coalesce((
      select jsonb_agg(jsonb_build_object('speaker', g.speaker, 'start_sec', g.start_sec, 'text', g.text) order by g.position)
      from public.transcript_segments g where g.recording_id = r.id), '[]'::jsonb) end,
    'parts', jsonb_build_object('summary', p_summary, 'transcript', p_transcript, 'highlights', p_highlights, 'audio', p_audio)
  )
  from public.recordings r
  where r.id = rec and r.deleted_at is null
    and not exists (select 1 from public.profiles p where p.id = r.created_by and p.suspended_at is not null);
$$;
revoke execute on function private.recording_bundle(uuid, boolean, boolean, boolean, boolean) from public, anon, authenticated;
