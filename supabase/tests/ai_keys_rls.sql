-- AI keys security checks (S3). Run in the Supabase SQL Editor after the
-- 20261102120000_ai_keys migration. Acts as the first owner in platform_staff
-- (A) and another account (B), then ends with RAISE, so nothing is kept.
-- Each line should match the expectation in brackets; FAIL means a problem.

do $$
declare
  a uuid; b uuid; ws uuid; personal_b uuid; ka uuid; kw uuid; cp uuid; r text := E'\n'; n int; j jsonb;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  -- B plays a customer: take them off staff for this (rolled-back) run.
  delete from public.platform_staff where user_id = b;
  select w.id into personal_b from public.workspaces w where w.is_personal and w.created_by = b;
  insert into public.workspaces (name, is_personal, created_by) values ('Key test', false, a) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner') on conflict do nothing;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, b, 'member') on conflict do nothing;

  -- A adds a personal key and a team key
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  insert into public.ai_keys (scope, user_id, provider, ciphertext, last4) values ('user', a, 'gpt', 'v1:test-a', 'aaaa') returning id into ka;
  insert into public.ai_keys (scope, workspace_id, provider, ciphertext, last4) values ('workspace', ws, 'claude', 'v1:test-ws', 'wwww') returning id into kw;
  r := r || E'1 owner adds own key and team key [ok]\n';
  execute 'reset role';

  -- B (a member)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.ai_keys where id = ka;
  r := r || format(E'2a member sees owner''s personal key=%s [0]\n', n);
  select count(*) into n from public.ai_keys where id = kw;
  r := r || format(E'2b member sees team key exists=%s [1]\n', n);
  begin execute 'select ciphertext from public.ai_keys'; r := r || E'2c member reads ciphertext column ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c ciphertext column not readable [ok]\n'; end;
  begin
    insert into public.ai_keys (scope, workspace_id, provider, ciphertext, last4) values ('workspace', ws, 'gpt', 'v1:x', 'xxxx');
    r := r || E'2d member adds team key ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d member adds team key denied [ok]\n'; end;
  begin
    insert into public.ai_keys (scope, workspace_id, provider, ciphertext, last4) values ('workspace', personal_b, 'gpt', 'v1:x', 'xxxx');
    r := r || E'2e team key on a Personal workspace ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e team key on Personal workspace denied [ok]\n'; end;
  update public.ai_keys set last4 = 'hack' where id in (ka, kw); get diagnostics n = row_count;
  r := r || format(E'2f member edits others'' keys rows=%s [0]\n', n);
  delete from public.ai_keys where id in (ka, kw); get diagnostics n = row_count;
  r := r || format(E'2g member deletes others'' keys rows=%s [0]\n', n);
  select count(*) into n from public.resolve_ai_keys(ws) k where k.id = kw;
  r := r || format(E'2h member''s requests in team workspace use team key=%s [1]\n', n);
  select count(*) into n from public.resolve_ai_keys(null) k where k.id in (ka, kw);
  r := r || format(E'2i member''s own requests use others'' keys=%s [0]\n', n);
  select count(*) into n from public.ai_key_for_test(kw);
  r := r || format(E'2j member fetches team key for testing=%s [0]\n', n);
  begin perform public.set_ai_key_scope(ws, 'member'); r := r || E'2k member changes key scope ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2k member changes key scope denied [ok]\n'; end;
  perform public.report_ai_key_failure(kw, 'test failure');
  insert into public.ai_usage (workspace_id, feature, provider, model, key_source) values (ws, 'chat', 'claude', 'm', 'own');
  r := r || E'2l member logs own usage [ok]\n';
  begin
    execute format('insert into public.ai_usage (user_id, feature, provider, key_source) values (%L, ''chat'', ''x'', ''echo'')', a);
    r := r || E'2m member logs usage as someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2m usage as someone else denied [ok]\n'; end;
  begin
    insert into public.ai_custom_providers (name, base_url, model) values ('x', 'https://x.test/v1', 'm');
    r := r || E'2n customer adds custom provider ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2n customer adds custom provider denied [ok]\n'; end;
  begin perform public.admin_ai_usage(30); r := r || E'2o customer reads admin AI usage ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2o customer admin AI usage denied [ok]\n'; end;
  update public.platform_settings set value = value where key = 'ai'; get diagnostics n = row_count;
  r := r || format(E'2p customer edits AI settings rows=%s [0]\n', n);
  execute 'reset role';

  select status into j from (select to_jsonb(k.status) as status from public.ai_keys k where k.id = kw) s;
  r := r || format(E'3a reported key marked failed=%s ["failed"]\n', j);
  select count(*) into n from public.notifications where user_id = a and type = 'ai_key_failed';
  r := r || format(E'3b owner notified of failing key=%s [1 or more]\n', n);

  -- A: scope switch, usage visibility, admin views (with MFA)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.ai_usage where workspace_id = ws;
  r := r || format(E'4a owner sees member''s usage in their workspace=%s [1]\n', n);
  perform public.set_ai_key_scope(ws, 'member');
  r := r || E'4b owner switches to each person''s keys [ok]\n';
  j := public.admin_ai_usage(30);
  r := r || format(E'4c staff AI usage loads=%s [true]\n', j ? 'totals');
  insert into public.ai_custom_providers (name, base_url, model, enabled) values ('Off', 'https://off.test/v1', 'm', false) returning id into cp;
  r := r || E'4d staff adds (disabled) custom provider [ok]\n';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.resolve_ai_keys(ws) k where k.id = kw;
  r := r || format(E'5a after switch, member''s requests use team key=%s [0]\n', n);
  select count(*) into n from public.ai_custom_providers where id = cp;
  r := r || format(E'5b customer sees disabled custom provider=%s [0]\n', n);
  select count(*) into n from public.resolve_custom_provider(cp);
  r := r || format(E'5c customer resolves disabled provider=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
