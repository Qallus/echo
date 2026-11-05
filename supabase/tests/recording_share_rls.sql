-- Recording share links and people. Run after 20261105100000_recording_share.
-- Ends with RAISE, so nothing is kept. A owns a recording in a Business
-- workspace B isn't in; B is the person it's shared with; anon is a visitor.

do $$
declare
  a uuid; b uuid; ws uuid; rec uuid; r text := E'\n'; n int; ea text; eb text;
  j jsonb; tok text; tok2 text; l1 uuid; l2 uuid; s1 uuid; path text;
begin
  select id into a from public.profiles limit 1;
  select id into b from public.profiles where id <> a limit 1;
  if b is null then raise exception 'Needs at least two users.'; end if;
  select email into ea from auth.users where id = a;
  select email into eb from auth.users where id = b;
  insert into public.workspaces (name, created_by) values ('Share test', a) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner') on conflict do nothing;
  insert into public.recordings (workspace_id, created_by, title, status, duration_sec) values (ws, a, 'Share test call', 'generated', 60) returning id into rec;
  path := ws || '/' || rec || '/audio.webm';
  update public.recordings set storage_path = path where id = rec;
  insert into public.transcript_segments (recording_id, position, speaker, start_sec, text) values (rec, 0, 'A', 0, 'Hello there');
  insert into public.summaries (recording_id, overview) values (rec, 'A short test call.');

  -- A, a member: creates links and shares
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', ea)::text, true);
  execute 'set local role authenticated';
  j := public.create_recording_link(rec, true, true, false, false, null); tok := j->>'token'; l1 := (j->>'id')::uuid;
  r := r || format(E'1a member creates a link, token length=%s [43]\n', char_length(tok));
  begin perform public.create_recording_link(rec, false, false, false, false, null); r := r || E'1b empty link ALLOWED (FAIL)\n';
  exception when others then r := r || E'1b link must share something [ok]\n'; end;
  select count(*) into n from public.recording_links where recording_id = rec; r := r || format(E'1c member sees links=%s [1]\n', n);
  begin insert into public.recording_links (recording_id, token_hash) values (rec, 'x'); r := r || E'1d direct insert ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d no direct inserts [ok]\n'; end;
  begin perform token_hash from public.recording_links limit 1; r := r || E'1e token hash readable (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e token hash not readable [ok]\n'; end;
  j := public.share_recording(rec, upper(eb)); s1 := (j->>'id')::uuid;
  r := r || format(E'1f shares with B, has_account=%s [true]\n', j->>'has_account');
  begin perform public.share_recording(rec, ea); r := r || E'1g share with self ALLOWED (FAIL)\n';
  exception when others then r := r || E'1g can''t share with yourself [ok]\n'; end;
  j := public.share_recording(rec, eb); r := r || format(E'1h sharing twice, already=%s [true]\n', j->>'already');
  execute 'reset role';
  select count(*) into n from public.notifications where user_id = b and type = 'recording_shared' and url = '/shared/' || rec;
  r := r || format(E'1i B notified=%s [1]\n', n);

  -- B, not in the workspace: sees it only through the share functions
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', eb)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.recordings where id = rec; r := r || format(E'2a B reads the recordings table=%s [0]\n', n);
  select count(*) into n from public.transcript_segments where recording_id = rec; r := r || format(E'2b B reads segments directly=%s [0]\n', n);
  select count(*) into n from public.recording_links where recording_id = rec; r := r || format(E'2c B sees links=%s [0]\n', n);
  select count(*) into n from public.shared_with_me() where recording_id = rec; r := r || format(E'2d shared with me lists it=%s [1]\n', n);
  j := public.shared_recording(rec); r := r || format(E'2e B opens it, segments=%s [1]\n', jsonb_array_length(j->'segments'));
  begin perform public.create_recording_link(rec, true, false, false, false, null); r := r || E'2f B creates a link ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2f B can''t create links [ok]\n'; end;
  begin perform public.revoke_recording_link(l1); r := r || E'2g B revokes A''s link ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2g B can''t revoke [ok]\n'; end;
  begin perform public.unshare_recording(s1); r := r || E'2h B removes the share ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2h B can''t remove shares [ok]\n'; end;
  begin update public.summaries set overview = 'hacked' where recording_id = rec; get diagnostics n = row_count; r := r || format(E'2i B edits the summary rows=%s [0]\n', n);
  exception when insufficient_privilege then r := r || E'2i B can''t edit [ok]\n'; end;
  r := r || format(E'2j B can read the audio=%s [true]\n', share_access.can_read_object(path));
  execute 'reset role';

  -- A visitor with the link
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  j := public.shared_link(tok);
  r := r || format(E'3a link shows title=%s summary=%s highlights=%s audio=%s [Share test call, yes, no, no]\n',
    j->>'title', case when j->'summary' <> 'null'::jsonb then 'yes' else 'no' end,
    case when j->'highlights' <> 'null'::jsonb then 'yes' else 'no' end, coalesce(j->>'audio_path', 'no'));
  r := r || format(E'3b wrong token=%s [null]\n', coalesce(public.shared_link(repeat('A', 43))::text, 'null'));
  r := r || format(E'3c audio readable without audio in the link=%s [false]\n', share_access.can_read_object(path));
  begin perform 1 from public.recording_links limit 1; r := r || E'3d visitor reads links ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3d visitor can''t read links [ok]\n'; end;
  begin perform public.create_recording_link(rec, true, false, false, false, null); r := r || E'3e visitor creates a link ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3e visitor can''t create links [ok]\n'; end;
  begin perform public.shared_with_me(); r := r || E'3f visitor calls shared_with_me ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3f visitor can''t list shares [ok]\n'; end;
  execute 'reset role';
  select view_count into n from public.recording_links where id = l1; r := r || format(E'3g views counted=%s [1]\n', n);

  -- Audio links, revoking, removing and trash
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', ea)::text, true);
  execute 'set local role authenticated';
  j := public.create_recording_link(rec, false, false, false, true, 7); tok2 := j->>'token'; l2 := (j->>'id')::uuid;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  r := r || format(E'4a audio link makes the file readable=%s [true]\n', share_access.can_read_object(path));
  r := r || format(E'4b other paths stay closed=%s [false]\n', share_access.can_read_object(ws || '/other/file.webm'));
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', ea)::text, true);
  execute 'set local role authenticated';
  perform public.revoke_recording_link(l2);
  perform public.unshare_recording(s1);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  r := r || format(E'4c revoked link shows=%s [null]\n', coalesce(public.shared_link(tok2)::text, 'null'));
  r := r || format(E'4d audio closed after revoking=%s [false]\n', share_access.can_read_object(path));
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', eb)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.shared_with_me(); r := r || format(E'4e removed person''s list=%s [0]\n', n);
  r := r || format(E'4f removed person opens it=%s [null]\n', coalesce(public.shared_recording(rec)::text, 'null'));
  execute 'reset role';
  update public.recordings set deleted_at = now() where id = rec;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  r := r || format(E'4g trashed recording''s link shows=%s [null]\n', coalesce(public.shared_link(tok)::text, 'null'));
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
