-- Redial app push devices and push privacy. Run after 20261105120000_mobile_devices.
-- Ends with RAISE, so nothing is kept. Two members, A and B.
-- (Removing a device is a plain DELETE under device_tokens_delete_own, which
-- uses the same owner-only rule as the select policy checked here.)

do $$
declare
  a uuid; b uuid; r text := E'\n'; n int; t text := 'ExponentPushToken[test-' || substr(md5(random()::text), 1, 16) || ']';
begin
  select id into a from public.profiles limit 1;
  select id into b from public.profiles where id <> a limit 1;
  if b is null then raise exception 'Needs at least two users.'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.register_device(t, 'android', '0.1.0'); r := r || E'1a A registers a phone [ok]\n';
  select count(*) into n from public.device_tokens; r := r || format(E'1b A sees own devices=%s [1]\n', n);
  begin perform token from public.device_tokens limit 1; r := r || E'1c token readable (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1c token itself not readable [ok]\n'; end;
  begin insert into public.device_tokens (user_id, token, platform) values (b, t || 'x', 'android'); r := r || E'1d direct insert ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'1d no direct inserts [ok]\n'; end;
  begin perform public.register_device('not-a-token', 'android', null); r := r || E'1e junk token ALLOWED (FAIL)\n';
  exception when others then r := r || E'1e junk token refused [ok]\n'; end;
  begin perform public.register_device(t, 'windows', null); r := r || E'1f unknown platform ALLOWED (FAIL)\n';
  exception when others then r := r || E'1f unknown platform refused [ok]\n'; end;
  update public.profiles set push_privacy = 'caller' where id = a; get diagnostics n = row_count; r := r || format(E'1g A sets own push privacy rows=%s [1]\n', n);
  begin update public.profiles set push_privacy = 'loud' where id = a; r := r || E'1h invalid privacy ALLOWED (FAIL)\n';
  exception when check_violation then r := r || E'1h invalid privacy refused [ok]\n'; end;
  update public.profiles set push_privacy = 'private' where id = b; get diagnostics n = row_count; r := r || format(E'1i A changes B''s privacy rows=%s [0]\n', n);
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.device_tokens; r := r || format(E'2a B sees A''s devices=%s [0]\n', n);
  update public.device_tokens set app_version = 'hacked'; get diagnostics n = row_count; r := r || format(E'2b B updates devices rows=%s [0]\n', n);
  -- The same phone signs in as B: it moves to B, so A stops getting its notifications.
  perform public.register_device(t, 'android', '0.1.1');
  select count(*) into n from public.device_tokens; r := r || format(E'2c phone moved to B, B sees=%s [1]\n', n);
  execute 'reset role';
  select count(*) into n from public.device_tokens where token = t and user_id = a; r := r || format(E'2d A still has it=%s [0]\n', n);

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform public.register_device(t, 'android', null); r := r || E'3a visitor registers ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3a visitor can''t register [ok]\n'; end;
  begin perform 1 from public.device_tokens limit 1; r := r || E'3b visitor reads devices ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3b visitor can''t read devices [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
