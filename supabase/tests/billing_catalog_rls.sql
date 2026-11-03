-- Billing and catalog security checks (S4). Run in the Supabase SQL Editor
-- after the 20261102130000_catalog migration. Acts as signed-out visitors,
-- the first owner (A) and another account (B), then ends with RAISE, so
-- nothing is kept. Each line should match the brackets; FAIL is a problem.

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; j jsonb;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  delete from public.platform_staff where user_id = b; -- B starts as a customer
  update public.catalog_products set active = false where id = 'translate'; -- one hidden product

  -- Signed-out visitor (pricing page)
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from public.catalog_products;
  r := r || format(E'1a visitor sees products=%s [all but the hidden one]\n', n);
  select count(*) into n from public.catalog_products where id = 'translate';
  r := r || format(E'1b visitor sees hidden product=%s [0]\n', n);
  select count(*) into n from public.catalog_prices;
  r := r || format(E'1c visitor sees prices=%s [a number]\n', n);
  begin execute 'update public.catalog_prices set unit_amount = 1'; r := r || E'1d visitor edits prices ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d visitor edits prices denied [ok]\n'; end;
  execute 'reset role';

  -- Customer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  update public.catalog_prices set unit_amount = 1 where key = 'pro_monthly'; get diagnostics n = row_count;
  r := r || format(E'2a customer edits a price rows=%s [0]\n', n);
  begin
    insert into public.catalog_products (id, kind, name) values ('hack', 'plan', 'Hack');
    r := r || E'2b customer adds product ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b customer adds product denied [ok]\n'; end;
  update public.platform_settings set value = '{"freeMinutes": 999999}' where key = 'billing'; get diagnostics n = row_count;
  r := r || format(E'2c customer edits billing settings rows=%s [0]\n', n);
  select count(*) into n from public.orders where user_id <> b;
  r := r || format(E'2d customer sees others'' orders=%s [0]\n', n);
  begin perform public.admin_orders(10); r := r || E'2e customer lists all orders ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e customer lists all orders denied [ok]\n'; end;
  begin perform public.admin_subscriptions(); r := r || E'2f customer lists subscriptions ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2f customer lists subscriptions denied [ok]\n'; end;
  execute 'reset role';

  -- B as Support: no billing
  insert into public.platform_staff (user_id, role) values (b, 'support');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin perform public.admin_orders(10); r := r || E'3a support lists orders ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3a support lists orders denied [ok]\n'; end;
  select count(*) into n from public.catalog_products where id = 'translate';
  r := r || format(E'3b support sees hidden product=%s [0]\n', n);
  execute 'reset role';

  -- B as Finance: sees billing, can manage it
  update public.platform_staff set role = 'finance' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  perform public.admin_orders(10);
  perform public.admin_subscriptions();
  r := r || E'4a finance lists orders and subscriptions [ok]\n';
  select count(*) into n from public.catalog_products where id = 'translate';
  r := r || format(E'4b finance sees hidden product=%s [1]\n', n);
  update public.catalog_prices set unit_amount = 1600 where key = 'pro_monthly'; get diagnostics n = row_count;
  r := r || format(E'4c finance edits a price rows=%s [1]\n', n);
  update public.platform_settings set value = jsonb_set(value, '{freeMinutes}', '400') where key = 'billing'; get diagnostics n = row_count;
  r := r || format(E'4d finance edits billing settings rows=%s [1]\n', n);
  update public.platform_settings set value = value where key = 'transcription'; get diagnostics n = row_count;
  r := r || format(E'4e finance edits transcription setting rows=%s [0]\n', n);
  execute 'reset role';

  -- Finance without MFA: nothing
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
  update public.catalog_prices set unit_amount = 1 where key = 'pro_monthly'; get diagnostics n = row_count;
  r := r || format(E'5 finance without MFA edits a price rows=%s [0]\n', n);
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
