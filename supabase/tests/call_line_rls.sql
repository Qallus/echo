-- Echo call line checks. Run after 20261104150000_call_line.
-- Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; wa uuid; wb uuid;
begin
  select m.user_id, m.workspace_id into a, wa from public.workspace_members m order by m.created_at limit 1;
  select m.user_id, m.workspace_id into b, wb from public.workspace_members m
  where m.user_id <> a and not exists (select 1 from public.workspace_members x where x.workspace_id = m.workspace_id and x.user_id = a)
  order by m.created_at limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.call_line_phones (user_id, number) values (a, '+14805550301'); r := r || E'1a member saves own cell [ok]\n';
  begin update public.call_line_phones set status = 'verified' where user_id = a; r := r || E'1b member marks self verified ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b member marks self verified denied [ok]\n'; end;
  begin insert into public.call_line_calls (user_id, kind, to_number) values (a, 'outbound', '+16025550199'); r := r || E'1c unverified member places a call ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1c unverified member places a call denied [ok]\n'; end;
  begin update public.call_line_phones set workspace_id = wb where user_id = a; r := r || E'1d default to someone else''s workspace ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d default to someone else''s workspace denied [ok]\n'; end;
  begin insert into public.call_line_phones (user_id, number) values (b, '+14805550302'); r := r || E'1e member saves a cell for someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1e member saves a cell for someone else denied [ok]\n'; end;
  execute 'reset role';

  -- The signed Twilio callback verifies it
  update public.call_line_phones set status = 'verified', verified_at = now() where user_id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.call_line_calls (user_id, kind, to_number, workspace_id) values (a, 'outbound', '+16025550199', wa); r := r || E'2a verified member places a call [ok]\n';
  begin insert into public.call_line_calls (user_id, kind, to_number, workspace_id) values (a, 'outbound', '+16025550199', wb); r := r || E'2b call saved to someone else''s workspace ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b call saved to someone else''s workspace denied [ok]\n'; end;
  begin insert into public.call_line_calls (user_id, kind) values (a, 'merge'); r := r || E'2c member forges a merged call ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c member forges a merged call denied [ok]\n'; end;
  begin update public.call_line_calls set recording_id = null where user_id = a; r := r || E'2d member links a recording ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d member links a recording denied [ok]\n'; end;
  update public.call_line_phones set number = '+14805550309' where user_id = a;
  select count(*) into n from public.call_line_phones where user_id = a and status = 'pending'; r := r || format(E'2e changing the number resets verification=%s [1]\n', n);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.call_line_phones where user_id = a; r := r || format(E'3a other member sees the cell=%s [0]\n', n);
  select count(*) into n from public.call_line_calls where user_id = a; r := r || format(E'3b other member sees the calls=%s [0]\n', n);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform 1 from public.call_line_calls; r := r || E'4a visitor reads calls ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4a visitor reads calls denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
