-- Scheduled sends checks. Run in the Supabase SQL Editor after
-- 20261107120000_scheduled_sends. Ends with RAISE, so nothing is kept.

do $$
declare a uuid; b uuid; cust uuid := gen_random_uuid(); r text := E'\n'; n int; k uuid; s2 uuid;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  insert into public.scheduled_sends (channel, send_at, label, total, created_by) values ('email', now() + interval '1 day', 'seed', 3, a) returning id into k;
  insert into public.scheduled_sends (channel, send_at, label, total, created_by, status) values ('sms', now(), 'running', 3, a, 'sending') returning id into s2;

  perform set_config('request.jwt.claims', json_build_object('sub', cust, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.scheduled_sends; r := r || format(E'1a customer sees=%s [0]\n', n);
  begin insert into public.scheduled_sends (channel, send_at) values ('email', now()); r := r || E'1b customer schedules ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1b customer schedules denied [ok]\n'; end;
  execute 'reset role';

  insert into public.platform_staff (user_id, role) values (b, 'marketing') on conflict (user_id) do update set role = excluded.role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  insert into public.scheduled_sends (channel, send_at, label, total) values ('sms', now() + interval '2 hours', 'mine', 1); r := r || E'2a marketing schedules [ok]\n';
  begin insert into public.scheduled_sends (channel, send_at, created_by) values ('email', now(), a); r := r || E'2b schedule as someone else ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b schedule as someone else denied [ok]\n'; end;
  begin insert into public.scheduled_sends (channel, send_at, sent) values ('email', now(), 5); r := r || E'2c set sent count ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c set sent count denied [ok]\n'; end;
  begin update public.scheduled_sends set status = 'sent', canceled_by = b where id = k; get diagnostics n = row_count; r := r || format(E'2d mark as sent rows=%s (FAIL if 1)\n', n);
  exception when insufficient_privilege then r := r || E'2d mark as sent denied [ok]\n'; end;
  begin update public.scheduled_sends set send_at = now() where id = k; r := r || E'2e change time ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2e change time denied [ok]\n'; end;
  update public.scheduled_sends set status = 'canceled', canceled_by = b where id = s2; get diagnostics n = row_count; r := r || format(E'2f cancel one already sending rows=%s [0]\n', n);
  update public.scheduled_sends set status = 'canceled', canceled_by = b where id = k; get diagnostics n = row_count; r := r || format(E'2g cancel scheduled rows=%s [1]\n', n);
  begin update public.scheduled_sends set status = 'scheduled', canceled_by = b where id = k; get diagnostics n = row_count; r := r || format(E'2h un-cancel rows=%s [0]\n', n);
  exception when insufficient_privilege then r := r || E'2h un-cancel denied [ok]\n'; end;
  execute 'reset role';

  update public.platform_staff set role = 'finance' where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.scheduled_sends; r := r || format(E'3 finance sees=%s [0]\n', n);
  execute 'reset role';
  raise exception 'RESULTS (rolled back):%', r;
end $$;
