-- Redial screening checks. Run in the Supabase SQL Editor after
-- 20261104120000_redial_screening and 20261104121000_redial_voicemail.
-- Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; staff uuid; r text := E'\n'; n int; la uuid; lb uuid; ca uuid; s text;
begin
  select user_id into staff from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into a from public.profiles where id <> staff order by created_at limit 1;
  select id into b from public.profiles where id not in (staff, a) order by created_at limit 1;
  if b is null then b := staff; end if;
  delete from public.platform_staff where user_id = a;
  update public.platform_settings set value = '{"requireMfa": true}' where key = 'admin_security';

  insert into public.redial_lines (owner_id, number) values (a, '+15550000001') returning id into la;
  insert into public.redial_lines (owner_id, number) values (b, '+15550000002') returning id into lb;
  insert into public.redial_calls (line_id, owner_id, from_number, status, summary, message) values (la, a, '+14805550100', 'message', 'Pat called', 'Call me') returning id into ca;

  -- Member A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_lines; r := r || format(E'1a member sees own line only=%s [1]\n', n);
  select count(*) into n from public.redial_calls; r := r || format(E'1b member sees own calls=%s [1]\n', n);
  update public.redial_lines set mode = 'all', forward_to = '+14805550199' where id = la; get diagnostics n = row_count; r := r || format(E'1c member edits own settings rows=%s [1]\n', n);
  begin update public.redial_lines set number = '+15550000009' where id = la; r := r || E'1d member changes the number ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d member changes the number denied [ok]\n'; end;
  begin update public.redial_lines set forward_to = '+15550000001' where id = la; r := r || E'1e ring number = Redial number ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'1e ring number = Redial number rejected [ok]\n'; end;
  update public.redial_lines set paused = true where id = lb; get diagnostics n = row_count; r := r || format(E'1f member edits someone else''s line rows=%s [0]\n', n);
  begin insert into public.redial_lines (owner_id, number) values (a, '+15550000003'); r := r || E'1g member gives themself a number ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1g member gives themself a number denied [ok]\n'; end;
  insert into public.redial_list_entries (line_id, number, kind) values (la, '+14805550111', 'block'); r := r || E'1h member blocks a number [ok]\n';
  begin insert into public.redial_list_entries (line_id, number, kind) values (lb, '+14805550111', 'allow'); r := r || E'1i member edits another line''s list ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1i member edits another line''s list denied [ok]\n'; end;
  update public.redial_calls set read_at = now(), category = 'personal' where id = ca; get diagnostics n = row_count; r := r || format(E'1j member marks a call read rows=%s [1]\n', n);
  begin update public.redial_calls set summary = 'forged' where id = ca; r := r || E'1k member rewrites the summary ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1k member rewrites the summary denied [ok]\n'; end;
  begin insert into public.redial_calls (line_id, owner_id) values (la, a); r := r || E'1l member inserts a call ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1l member inserts a call denied [ok]\n'; end;
  insert into public.redial_callbacks (line_id, call_id, due_at) values (la, ca, now() + interval '1 day'); r := r || E'1m member adds a callback [ok]\n';
  begin insert into public.redial_callbacks (line_id, due_at) values (lb, now()); r := r || E'1n callback on another line ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1n callback on another line denied [ok]\n'; end;
  begin perform public.admin_redial_lines(); r := r || E'1o member lists all lines ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1o member lists all lines denied [ok]\n'; end;
  execute 'reset role';
  select count(*) into n from public.notifications where user_id = a and type = 'redial_call' and created_at > now() - interval '1 minute';
  r := r || format(E'1p (setup) notification on insert=%s [0: only updates notify]\n', n);

  -- Member B can't see A's calls
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_calls where id = ca; r := r || format(E'2a other member sees the call=%s [0]\n', n);
  select count(*) into n from public.redial_list_entries where line_id = la; r := r || format(E'2b other member sees the block list=%s [0]\n', n);
  execute 'reset role';

  -- Staff (owner, MFA): lines and counts, never call content
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.admin_redial_lines() where id in (la, lb); r := r || format(E'3a staff lists lines=%s [2]\n', n);
  select count(*) into n from public.redial_calls where id = ca; r := r || format(E'3b staff reads the call=%s [0]\n', n);
  begin s := public.admin_redial_assign('nobody@example.invalid', '+15550000004', ''); r := r || E'3c assign to unknown email ALLOWED (FAIL)\n';
  exception when others then r := r || E'3c assign to unknown email rejected [ok]\n'; end;
  execute 'reset role';

  -- Visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform 1 from public.redial_calls; r := r || E'4a visitor reads calls ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4a visitor reads calls denied [ok]\n'; end;
  execute 'reset role';

  -- The webhook saving a summary notifies the owner
  update public.redial_calls set summary = null, message = null where id = ca;
  update public.redial_calls set summary = 'Dana about the invoice' where id = ca;
  select count(*) into n from public.notifications where user_id = a and type = 'redial_call' and created_at > now() - interval '1 minute';
  r := r || format(E'5a owner notified when the summary arrives=%s [1]\n', n);

  raise exception 'RESULTS (rolled back): %', r;
end $$;
