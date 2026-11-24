-- Clearer "your recording is ready" notice. When transcription finishes with a
-- summary, it says the transcript, branded summary and outline are ready to
-- review (and shows the overview's first line); without a summary it says the
-- transcript is ready. Same trigger, same notification type and preferences.

create or replace function private.notify_recording_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  overview text;
begin
  if new.created_by is null or old.status <> 'processing' or new.status = 'processing' then return null; end if;
  if new.status = 'failed' then
    perform private.notify(new.created_by, 'transcript_failed', 'Transcription failed: ' || new.title,
      coalesce(new.processing_error, 'Open the recording to try again.'), '/recordings/' || new.id, jsonb_build_object('recording_id', new.id));
  elsif new.status = 'generated' then
    select s.overview into overview from public.summaries s where s.recording_id = new.id;
    perform private.notify(new.created_by, 'transcript_ready', 'Ready to review: ' || new.title,
      'Your transcript, branded summary and outline are ready.' || coalesce(' ' || left(overview, 200), ''),
      '/recordings/' || new.id, jsonb_build_object('recording_id', new.id));
  else
    perform private.notify(new.created_by, 'transcript_ready', 'Transcript ready: ' || new.title,
      'Your recording has been transcribed. Open it to write a summary.', '/recordings/' || new.id, jsonb_build_object('recording_id', new.id));
  end if;
  return null;
end $$;
