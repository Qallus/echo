-- Redial setup checks. Run in the Supabase SQL Editor after
-- 20261109130000_redial_setup. Ends with RAISE, so nothing is kept.

do $$
declare a uuid; b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); r text := E'\n'; n int; t text;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  -- Two throwaway customers; the signup trigger makes their profiles.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'setup-test-b@example.test', '{"full_name": "Test B", "account_type": "business", "company_name": "Test Co"}'),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'setup-test-c@example.test', '{"full_name": "Test C"}');
  select account_type into t from public.profiles where id = b; r := r || format(E'0a business signup account_type=%s [business]\n', t);
  select account_type into t from public.profiles where id = c; r := r || format(E'0b personal signup account_type=%s [personal]\n', t);
  select count(*) into n from public.workspace_members where user_id = b; r := r || format(E'0c business signup workspaces=%s [2]\n', n);

  -- A customer saves their own answers.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  insert into public.redial_setups (user_id, step, answers) values (b, 1, '{"about": {"fullName": "Test"}}'); r := r || E'1a save own answers [ok]\n';
  begin insert into public.redial_setups (user_id, answers) values (c, '{}'); r := r || E'1b save for someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b save for someone else denied [ok]\n'; end;
  update public.redial_setups set step = 2, answers = answers || '{"phone": {"carrier": "tmobile"}}' where user_id = b; get diagnostics n = row_count; r := r || format(E'1c update own rows=%s [1]\n', n);
  update public.redial_setups set status = 'submitted' where user_id = b; get diagnostics n = row_count; r := r || format(E'1d submit own rows=%s [1]\n', n);
  begin update public.redial_setups set status = 'active' where user_id = b; get diagnostics n = row_count; r := r || format(E'1e mark own active rows=%s (FAIL if 1)\n', n);
  exception when insufficient_privilege then r := r || E'1e mark own active denied [ok]\n'; end;
  begin update public.redial_setups set line_id = gen_random_uuid() where user_id = b; r := r || E'1f set own line ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1f set own line denied [ok]\n'; end;
  update public.profiles set account_type = 'personal' where id = b; get diagnostics n = row_count; r := r || format(E'1g change own account type rows=%s [1]\n', n);
  begin update public.profiles set account_type = 'other' where id = b; r := r || E'1h invalid account type ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'1h invalid account type denied [ok]\n'; end;
  execute 'reset role';

  -- Another customer can't see or change it.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_setups; r := r || format(E'2a other customer sees=%s [0]\n', n);
  update public.redial_setups set answers = '{}' where user_id = b; get diagnostics n = row_count; r := r || format(E'2b other customer edits rows=%s [0]\n', n);
  update public.profiles set account_type = 'business' where id = b; get diagnostics n = row_count; r := r || format(E'2c other customer edits account type rows=%s [0]\n', n);
  execute 'reset role';

  -- Staff read it only with two-step sign-in.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_setups where user_id = b; r := r || format(E'3a staff (two-step) sees=%s [1]\n', n);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  -- Admin → Settings → Security: when two-step isn't required for staff, they see it too.
  t := case when coalesce((select (value ->> 'requireMfa')::boolean from public.platform_settings where key = 'admin_security'), true) then '0' else '1' end;
  select count(*) into n from public.redial_setups where user_id = b; r := r || format(E'3b staff without two-step sees=%s [%s]\n', n, t);
  execute 'reset role';

  -- Nobody signed out.
  execute 'set local role anon';
  begin select count(*) into n from public.redial_setups; r := r || format(E'4 anon sees=%s (FAIL)\n', n);
  exception when insufficient_privilege then r := r || E'4 anon denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back):%', r;
end $$;
