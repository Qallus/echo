-- Email v2 checks (campaigns, saved audiences, template status/revision,
-- test sends, Claude connector confirmations). Run in the Supabase SQL Editor
-- after 20261106100000_email_v2. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; cust uuid := gen_random_uuid(); r text := E'\n'; n int; t uuid; c uuid; k uuid; x uuid; rev int; rev2 int;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  -- The customer is any signed-in id with no staff role; b is another account,
  -- made Finance and then Marketing for the staff checks.
  select id into b from public.profiles where id <> a order by created_at limit 1;
  insert into public.email_templates (name, subject) values ('RLS v2 test', 'Hi') returning id, revision into t, rev;
  insert into public.email_campaigns (subject, total, created_by) values ('Seed', 3, a) returning id into c;
  insert into public.email_audiences (name, definition, created_by) values ('RLS v2 seed', '{"source":"contacts"}', a);

  -- Customer: nothing
  perform set_config('request.jwt.claims', json_build_object('sub', cust, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.email_campaigns; r := r || format(E'1a customer sees campaigns=%s [0]\n', n);
  select count(*) into n from public.email_audiences; r := r || format(E'1b customer sees audiences=%s [0]\n', n);
  begin insert into public.email_campaigns (subject) values ('x'); r := r || E'1c customer creates campaign ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1c customer creates campaign denied [ok]\n'; end;
  begin insert into public.email_audiences (name, definition) values ('x', '{}'); r := r || E'1d customer creates audience ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d customer creates audience denied [ok]\n'; end;
  execute 'reset role';

  -- Owner prepares a Claude confirmation
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into public.mcp_confirmations (client_id, tool, payload, summary) values ('client-1', 'email_send', '{"total":3}', 'test') returning id into k;
  begin insert into public.mcp_confirmations (user_id, tool, payload) values (b, 'email_send', '{}'); r := r || E'2a confirmation for someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2a confirmation for someone else denied [ok]\n'; end;
  begin update public.mcp_confirmations set expires_at = now() + interval '1 year' where id = k; r := r || E'2b extend expiry ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b extend expiry denied [ok]\n'; end;
  execute 'reset role';

  -- Customer can't see or use it
  perform set_config('request.jwt.claims', json_build_object('sub', cust, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.mcp_confirmations where id = k; r := r || format(E'2c other person sees confirmation=%s [0]\n', n);
  update public.mcp_confirmations set used_at = now() where id = k; get diagnostics n = row_count;
  r := r || format(E'2d other person claims it rows=%s [0]\n', n);
  execute 'reset role';

  -- Owner claims it once
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.mcp_confirmations set used_at = now() where id = k and used_at is null; get diagnostics n = row_count;
  r := r || format(E'2e owner claims rows=%s [1]\n', n);
  update public.mcp_confirmations set used_at = now() where id = k and used_at is null; get diagnostics n = row_count;
  r := r || format(E'2f second claim rows=%s [0]\n', n);
  execute 'reset role';
  insert into public.mcp_confirmations (user_id, tool, payload, expires_at) values (a, 'email_send', '{}', now() - interval '1 minute') returning id into x;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.mcp_confirmations set used_at = now() where id = x; get diagnostics n = row_count;
  r := r || format(E'2g expired claim rows=%s [0]\n', n);
  execute 'reset role';

  -- Finance: no email
  insert into public.platform_staff (user_id, role) values (b, 'finance') on conflict (user_id) do update set role = excluded.role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.email_campaigns; r := r || format(E'3a finance sees campaigns=%s [0]\n', n);
  execute 'reset role';

  -- Marketing: sends and audiences
  update public.platform_staff set role = 'marketing' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.email_campaigns where id = c; r := r || format(E'4a marketing sees campaign=%s [1]\n', n);
  update public.email_campaigns set sent = 2, failed = 1, status = 'partial' where id = c; get diagnostics n = row_count;
  r := r || format(E'4b marketing records totals rows=%s [1]\n', n);
  begin update public.email_campaigns set subject = 'changed' where id = c; r := r || E'4c edit campaign subject ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4c edit campaign subject denied [ok]\n'; end;
  begin update public.email_campaigns set created_by = b where id = c; r := r || E'4d change who sent it ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4d change who sent it denied [ok]\n'; end;
  insert into public.email_audiences (name, definition) values ('RLS v2 marketing', '{"source":"waitlist"}'); r := r || E'4e marketing saves audience [ok]\n';
  insert into public.email_sends (template_id, campaign_id, to_email, subject, status) values (t, c, 'me@example.com', '[Test] Hi', 'test');
  r := r || E'4f marketing logs a test send [ok]\n';
  update public.email_templates set status = 'draft', subject = 'Hello' where id = t;
  select revision into rev2 from public.email_templates where id = t;
  r := r || format(E'4g content change bumps revision %s -> %s [+1]\n', rev, rev2);
  update public.email_templates set sends = sends + 1 where id = t;
  select revision into n from public.email_templates where id = t;
  r := r || format(E'4h send counter keeps revision=%s [%s]\n', n, rev2);
  begin update public.email_templates set revision = 1 where id = t; r := r || E'4i set revision directly ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4i set revision directly denied [ok]\n'; end;
  begin update public.email_templates set created_via = 'claude' where id = t; r := r || E'4j change created_via ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'4j change created_via denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back):%', r;
end $$;
