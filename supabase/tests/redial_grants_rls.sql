-- Redial per-line permissions. Run after 20261104160000_redial_line_grants.
-- Ends with RAISE, so nothing is kept. Needs two users who share a workspace
-- (owner A and teammate B) and one who doesn't (C).

do $$
declare
  a uuid; b uuid; c uuid; ws uuid; r text := E'\n'; n int; la uuid; ca uuid; g uuid; t jsonb; eb text; ec text;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    -- No shared workspace yet: a temporary Business workspace with A and B.
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Grants test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select id into c from public.profiles where id not in (a, b)
    and not exists (select 1 from public.workspace_members x join public.workspace_members y on y.workspace_id = x.workspace_id where x.user_id = a and y.user_id = profiles.id)
  limit 1;

  select email into eb from auth.users where id = b;
  select email into ec from auth.users where id = c;

  insert into public.redial_lines (owner_id, number) values (a, '+15550000021') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status, summary, transcript) values (la, a, 'message', 'Pat called', '[{"role": "caller", "text": "Hi"}]') returning id into ca;

  -- Owner shares with B (summaries only)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  g := public.redial_grant(la, eb, array['read_summary']); r := r || E'1a owner shares with a teammate [ok]\n';
  if c is not null then
    begin perform public.redial_grant(la, ec, array['read_summary']); r := r || E'1b share with an outsider ALLOWED (FAIL)\n';
    exception when others then r := r || E'1b share with an outsider rejected [ok]\n'; end;
  end if;
  begin perform public.redial_grant(la, 'x@example.invalid', array['read_summary', 'superpowers']); r := r || E'1c unknown capability ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c unknown email or capability rejected [ok]\n'; end;
  select count(*) into n from public.redial_line_people(la); r := r || format(E'1d owner sees who it is shared with=%s [1]\n', n);
  select count(*) into n from public.redial_transcripts(la, array[ca]); r := r || format(E'1e owner reads the transcript=%s [1]\n', n);
  begin select transcript into t from public.redial_calls where id = ca; r := r || E'1f transcript readable directly ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1f transcript column not readable directly [ok]\n'; end;
  execute 'reset role';

  -- B: summaries yes, transcript and settings no
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_calls where id = ca; r := r || format(E'2a teammate sees the call=%s [1]\n', n);
  select count(*) into n from public.redial_transcripts(la, array[ca]); r := r || format(E'2b teammate reads the transcript=%s [0]\n', n);
  update public.redial_lines set mode = 'all' where id = la; get diagnostics n = row_count; r := r || format(E'2c teammate changes rules rows=%s [0]\n', n);
  begin insert into public.redial_list_entries (line_id, number, kind) values (la, '+14805550123', 'block'); r := r || E'2d teammate edits lists ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d teammate edits lists denied [ok]\n'; end;
  update public.redial_line_grants set capabilities = array['read_summary', 'read_transcript', 'manage_rules'] where id = g; get diagnostics n = row_count;
  r := r || format(E'2e teammate widens own access rows=%s [0]\n', n);
  begin perform public.redial_line_people(la); r := r || E'2f teammate lists who it is shared with ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2f teammate lists sharing denied [ok]\n'; end;
  insert into public.redial_callbacks (line_id, call_id, due_at) values (la, ca, now() + interval '1 day'); r := r || E'2g teammate adds own callback [ok]\n';
  execute 'reset role';

  -- Owner adds transcripts and rules
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.redial_line_grants set capabilities = array['read_summary', 'read_transcript', 'manage_rules'] where id = g; get diagnostics n = row_count;
  r := r || format(E'3a owner widens the grant rows=%s [1]\n', n);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_transcripts(la, array[ca]); r := r || format(E'3b teammate now reads the transcript=%s [1]\n', n);
  update public.redial_lines set mode = 'all' where id = la; get diagnostics n = row_count; r := r || format(E'3c teammate now changes rules rows=%s [1]\n', n);
  begin update public.redial_lines set number = '+15550000099' where id = la; r := r || E'3d teammate changes the number ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3d teammate changes the number denied [ok]\n'; end;
  execute 'reset role';

  -- An outsider sees nothing
  if c is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.redial_calls where line_id = la; r := r || format(E'4a outsider sees the calls=%s [0]\n', n);
    select count(*) into n from public.redial_lines where id = la; r := r || format(E'4b outsider sees the line=%s [0]\n', n);
    execute 'reset role';
  end if;

  raise exception 'RESULTS (rolled back): %', r;
end $$;
