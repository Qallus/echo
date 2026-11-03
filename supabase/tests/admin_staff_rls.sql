-- Super Admin security checks (S1 staff/MFA, S2 suspension and transfers).
-- Run in the Supabase SQL Editor. It acts as two real users (the first owner
-- in platform_staff = A, another account = B), then ends with RAISE, so every
-- change is rolled back. Read the results in the error message: each line
-- should match the expectation in brackets; anything with FAIL is a problem.

do $$
declare
  a uuid; b uuid; b_email text; a_email text; ws uuid; r text := E'\n'; n int; j jsonb;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  -- B plays a customer: take them off staff for this (rolled-back) run.
  delete from public.platform_staff where user_id = b;
  select email into a_email from auth.users where id = a;
  select email into b_email from auth.users where id = b;

  -- 1. Owner without two-step sign-in (aal1): no admin powers
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select coalesce(array_length(permissions, 1), 0) into n from public.my_staff();
  r := r || format(E'1a owner without MFA, permissions=%s [0]\n', n);
  begin perform public.admin_list_users(); r := r || E'1b without MFA, list users ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b without MFA, list users denied [ok]\n'; end;
  select count(*) into n from public.orders where user_id <> a;
  r := r || format(E'1c without MFA, other people''s orders=%s [0]\n', n);
  execute 'reset role';

  -- 2. Owner with two-step sign-in (aal2)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  j := public.admin_dashboard();
  r := r || format(E'2a with MFA, dashboard users=%s [a number]\n', j ->> 'users');
  select count(*) into n from public.admin_list_users();
  r := r || format(E'2b users listed=%s [all users]\n', n);
  j := public.admin_user_detail(b);
  r := r || format(E'2c customer 360 loads=%s [true]\n', j ? 'workspaces');
  perform public.admin_audit('test.ping', 'test', '1', '{}');
  select count(*) into n from public.admin_audit_log where action = 'test.ping';
  r := r || format(E'2d audit row written and visible=%s [1]\n', n);
  begin execute 'delete from public.admin_audit_log'; r := r || E'2e delete audit log ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e delete audit log denied [ok]\n'; end;
  begin perform public.admin_set_staff_role(a_email, 'support'); r := r || E'2f owner demotes self ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2f owner demotes self denied [ok]\n'; end;
  execute 'reset role';

  -- 3. Customer (not staff), even with MFA
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.my_staff();
  r := r || format(E'3a customer staff rows=%s [0]\n', n);
  begin perform public.admin_dashboard(); r := r || E'3b customer dashboard ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3b customer dashboard denied [ok]\n'; end;
  begin perform public.admin_audit('x'); r := r || E'3c customer writes audit ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3c customer writes audit denied [ok]\n'; end;
  select count(*) into n from public.admin_audit_log;
  r := r || format(E'3d customer sees audit rows=%s [0]\n', n);
  begin execute 'insert into public.admin_audit_log (action) values (''x'')'; r := r || E'3e direct audit insert ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3e direct audit insert denied [ok]\n'; end;
  begin execute format('update public.profiles set suspended_at = now() where id = %L', b); r := r || E'3f edits own suspended_at ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3f edits own suspended_at denied [ok]\n'; end;
  execute 'reset role';

  -- 4. Owner makes B Support: Support can't see billing, manage staff or suspend staff
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_set_staff_role(b_email, 'support');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  j := public.admin_dashboard();
  r := r || format(E'4a support dashboard, billing hidden=%s [true]\n', coalesce(j -> 'subscriptions', 'null'::jsonb) = 'null'::jsonb);
  begin perform public.admin_list_staff(); r := r || E'4b support lists staff ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4b support lists staff denied [ok]\n'; end;
  begin perform public.admin_suspend_user(a, 'x'); r := r || E'4c support suspends owner ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4c support suspends owner denied [ok]\n'; end;
  execute 'reset role';

  -- 5. Owner removes B from staff, suspends, B is locked out, owner restores
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_set_staff_role(b_email, null);
  perform public.admin_suspend_user(b, 'test');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  r := r || format(E'5a suspended user am_i_suspended=%s [true]\n', public.am_i_suspended());
  select count(*) into n from public.workspaces;
  r := r || format(E'5b suspended user sees workspaces=%s [0]\n', n);
  select count(*) into n from public.recordings;
  r := r || format(E'5c suspended user sees recordings=%s [0]\n', n);
  begin execute format('update public.profiles set suspended_at = null where id = %L', b); r := r || E'5d self-restore ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'5d self-restore denied [ok]\n'; end;
  execute 'reset role';
  select count(*) into n from auth.sessions where user_id = b;
  r := r || format(E'5e sessions left after suspend=%s [0]\n', n);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_restore_user(b);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.workspaces;
  r := r || format(E'5f restored user sees workspaces=%s [1 or more]\n', n);
  execute format('update public.profiles set full_name = full_name where id = %L', b);
  r := r || E'5g restored user can edit own name [ok]\n';
  execute 'reset role';

  -- 6. Business workspace ownership transfer
  insert into public.workspaces (name, is_personal, created_by) values ('Transfer test', false, a) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner') on conflict do nothing;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, b, 'member') on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_transfer_workspace(ws, b);
  execute 'reset role';
  r := r || format(E'6 roles after transfer=%s [A:admin,B:owner]\n', (
    select string_agg(case when m.user_id = b then 'B' else 'A' end || ':' || m.role::text, ',' order by m.user_id = b)
    from public.workspace_members m where m.workspace_id = ws));
  select count(*) into n from public.admin_audit_log
  where action in ('staff.set_role', 'staff.remove', 'user.suspend', 'user.restore', 'workspace.transfer_owner');
  r := r || format(E'7 audit rows for those actions=%s [5]\n', n);

  raise exception 'RESULTS (rolled back): %', r;
end $$;
