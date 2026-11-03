-- Speakers, summary visuals and the workspace calendar. Run in the Supabase
-- SQL Editor after 20261104100000_speakers_visuals_calendar. Ends with
-- RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; wa uuid; wb uuid; rec uuid; recb uuid; ev uuid; r text := E'\n'; n int;
begin
  -- Two users with a workspace each that the other isn't in.
  select m.user_id, m.workspace_id into a, wa from public.workspace_members m
  order by m.created_at limit 1;
  select m.user_id, m.workspace_id into b, wb from public.workspace_members m
  where m.user_id <> a and not exists (select 1 from public.workspace_members x where x.workspace_id = m.workspace_id and x.user_id = a)
  order by m.created_at limit 1;
  if b is null then raise exception 'Needs a second user with a workspace of their own.'; end if;
  insert into public.recordings (workspace_id, created_by, title, source, status) values (wa, a, 'RLS call', 'upload', 'generated') returning id into rec;
  insert into public.recordings (workspace_id, created_by, title, source, status) values (wb, b, 'RLS other call', 'upload', 'generated') returning id into recb;
  insert into public.summaries (recording_id, template, overview) values (rec, 'Adaptive', 'Test');

  -- Member of A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.recordings set speakers = '{"Speaker A": {"name": "Pat"}}' where id = rec; get diagnostics n = row_count;
  r := r || format(E'1a member names a speaker rows=%s [1]\n', n);
  update public.summaries set visual = 'kanban', dates = '[{"title": "Visit", "date": "2026-12-01"}]' where recording_id = rec; get diagnostics n = row_count;
  r := r || format(E'1b member saves visual and dates rows=%s [1]\n', n);
  insert into public.calendar_events (workspace_id, recording_id, title, starts_at, ends_at) values (wa, rec, 'Site visit', now() + interval '1 day', now() + interval '1 day 1 hour') returning id into ev;
  r := r || E'1c member adds an event from a recording [ok]\n';
  begin insert into public.calendar_events (workspace_id, title, starts_at, ends_at) values (wb, 'Sneaky', now(), now() + interval '1 hour'); r := r || E'1d member adds to someone else''s calendar ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d member adds to someone else''s calendar denied [ok]\n'; end;
  begin insert into public.calendar_events (workspace_id, recording_id, title, starts_at, ends_at) values (wa, recb, 'Cross link', now(), now() + interval '1 hour'); r := r || E'1e link another workspace''s recording ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e link another workspace''s recording denied [ok]\n'; end;
  begin insert into public.calendar_events (workspace_id, title, starts_at, ends_at) values (wa, 'Backwards', now(), now() - interval '1 hour'); r := r || E'1f end before start ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'1f end before start rejected [ok]\n'; end;
  execute 'reset role';

  -- Member of B only
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.calendar_events where id = ev; r := r || format(E'2a other user sees the event=%s [0]\n', n);
  update public.calendar_events set title = 'x' where id = ev; get diagnostics n = row_count; r := r || format(E'2b other user edits it rows=%s [0]\n', n);
  delete from public.calendar_events where id = ev; get diagnostics n = row_count; r := r || format(E'2c other user deletes it rows=%s [0]\n', n);
  update public.recordings set speakers = '{}' where id = rec; get diagnostics n = row_count; r := r || format(E'2d other user renames speakers rows=%s [0]\n', n);
  execute 'reset role';

  -- Visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform 1 from public.calendar_events; r := r || E'3a visitor reads calendars ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3a visitor reads calendars denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
