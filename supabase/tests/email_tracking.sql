-- Email tracking checks (Resend delivery events). Run in the Supabase SQL
-- Editor after 20261107090000_email_tracking. Ends with RAISE, so nothing is kept.

do $$
declare s uuid; r text := E'\n'; n int; ok boolean; b uuid; a uuid; v record;
begin
  select user_id into a from public.platform_staff where role = 'owner' order by created_at limit 1;
  select id into b from public.profiles where id <> a order by created_at limit 1;
  insert into public.email_sends (to_email, subject, status, provider_id) values ('Track.Test@example.com', 'T', 'sent', 're_test_1') returning id into s;
  ok := public.email_track_event('svix_1', 're_test_1', 'delivered', now(), null);
  ok := public.email_track_event('svix_2', 're_test_1', 'opened', now(), null);
  ok := public.email_track_event('svix_3', 're_test_1', 'opened', now(), null);
  ok := public.email_track_event('svix_3', 're_test_1', 'opened', now(), null); r := r || format(E'1 duplicate delivery returns %s [false]\n', ok);
  ok := public.email_track_event('svix_4', 're_test_1', 'clicked', now(), null, 'https://echo.redial.si');
  select open_count, click_count, delivered_at is not null d, last_event into v from public.email_sends where id = s;
  r := r || format(E'2 opens=%s [2] clicks=%s [1] delivered=%s [t] last=%s [clicked]\n', v.open_count, v.click_count, v.d, v.last_event);
  ok := public.email_track_event('svix_5', 're_test_1', 'bounced', now(), null, null, 'Mailbox does not exist', false);
  select count(*) into n from public.email_unsubscribes where email = 'track.test@example.com'; r := r || format(E'3 soft bounce suppresses=%s [0]\n', n);
  ok := public.email_track_event('svix_6', 're_test_1', 'bounced', now(), null, null, 'Permanent', true);
  select count(*) into n from public.email_unsubscribes where email = 'track.test@example.com' and reason = 'bounced'; r := r || format(E'4 hard bounce suppresses=%s [1]\n', n);
  ok := public.email_track_event('svix_7', 're_unknown', 'complained', now(), 'Other@Example.com');
  select count(*) into n from public.email_unsubscribes where email = 'other@example.com' and reason = 'complained'; r := r || format(E'5 complaint on unlogged email suppresses=%s [1]\n', n);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  begin perform public.email_track_event('svix_8', 're_test_1', 'opened', now()); r := r || E'6 staff calls tracker ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'6 staff calls tracker denied [ok]\n'; end;
  select count(*) into n from public.email_events where provider_id = 're_test_1'; r := r || format(E'7 owner sees events=%s [6]\n', n);
  select opened into n from public.email_campaign_stats limit 1; r := r || E'8 owner reads stats view [ok]\n';
  execute 'reset role';

  insert into public.platform_staff (user_id, role) values (b, 'finance') on conflict (user_id) do update set role = excluded.role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.email_events; r := r || format(E'9 finance sees events=%s [0]\n', n);
  begin insert into public.email_events (svix_id, provider_id, type) values ('x', 'x', 'opened'); r := r || E'10 finance writes event ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'10 finance writes event denied [ok]\n'; end;
  execute 'reset role';
  raise exception 'RESULTS (rolled back):%', r;
end $$;
