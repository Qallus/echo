-- Redial billing checks: usage math and who can read it. Run after
-- 20261104130000_redial_billing. Ends with RAISE, so nothing is kept.

do $$
declare
  a uuid; b uuid; staff uuid; r text := E'\n'; la uuid; u jsonb; o uuid;
begin
  select user_id into staff from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into a from public.profiles where id <> staff order by created_at limit 1;
  select id into b from public.profiles where id not in (staff, a) order by created_at limit 1;
  if b is null then b := staff; end if;
  delete from public.platform_staff where user_id = a;
  delete from public.subscriptions where user_id = a;
  update public.platform_settings set value = value || '{"redialFreeMinutes": 10}' where key = 'billing';
  update public.platform_settings set value = '{"requireMfa": true}' where key = 'admin_security';

  insert into public.redial_lines (owner_id, number) values (a, '+15550000011') returning id into la;
  insert into public.redial_calls (line_id, owner_id, status, ai_seconds) values (la, a, 'completed', 61), (la, a, 'message', 30), (la, a, 'forwarded', null);
  insert into public.redial_calls (line_id, owner_id, status, ai_seconds, started_at) values (la, a, 'completed', 600, now() - interval '40 days');

  -- As the webhooks do (service role)
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  u := public.redial_usage(a);
  r := r || format(E'1a free: used=%s allowance=%s remaining=%ss free=%s [3, 10, 420, true]\n', u->>'used_minutes', u->>'allowance', u->>'remaining_seconds', u->>'free');

  insert into public.subscriptions (id, user_id, status, items) values ('sub_rls_redial', a, 'active', '[{"price_key": "redial_monthly", "quantity": 1}, {"price_key": "pro_monthly", "quantity": 1}]');
  u := public.redial_usage(a);
  r := r || format(E'1b plan: allowance=%s free=%s [50, false]\n', u->>'allowance', u->>'free');

  insert into public.orders (user_id, status, total) values (a, 'paid', 1500) returning id into o;
  insert into public.order_items (order_id, price_key, description, quantity, amount) values (o, 'pack_redial_100', '100 screening minutes', 1, 1500);
  u := public.redial_usage(a);
  r := r || format(E'1c pack: pack_minutes=%s allowance=%s [100, 150]\n', u->>'pack_minutes', u->>'allowance');

  update public.redial_calls set ai_seconds = 3600 where line_id = la and started_at < now() - interval '30 days';
  u := public.redial_usage(a);
  r := r || format(E'1d last month used 60 min (10 over the plan) -> pack left=%s [90]\n', u->>'pack_minutes');

  -- Access
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  u := public.redial_usage(); r := r || format(E'2a member reads own usage used=%s [3]\n', u->>'used_minutes');
  begin perform public.redial_usage(b); r := r || E'2b member reads someone else''s usage ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b member reads someone else''s usage denied [ok]\n'; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  u := public.redial_usage(a); r := r || format(E'2c staff reads a member''s usage allowance=%s [140]\n', u->>'allowance');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform public.redial_usage(a); r := r || E'2d visitor reads usage ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2d visitor reads usage denied [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
