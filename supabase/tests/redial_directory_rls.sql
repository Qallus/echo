-- Redial directory and transfers. Run after 20261104210000_redial_directory.
-- Ends with RAISE, so nothing is kept. Owner A, teammate B.

do $$
declare
  a uuid; b uuid; ws uuid; r text := E'\n'; n int; la uuid; lb uuid; ca uuid; eb text; d uuid; t uuid;
begin
  select m1.user_id, m2.user_id, m1.workspace_id into a, b, ws from public.workspace_members m1
  join public.workspace_members m2 on m2.workspace_id = m1.workspace_id and m2.user_id <> m1.user_id limit 1;
  if b is null then
    select id into a from public.profiles limit 1;
    select id into b from public.profiles where id <> a limit 1;
    if b is null then raise exception 'Needs at least two users.'; end if;
    insert into public.workspaces (name, created_by) values ('Directory test', a) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, a, 'owner'), (ws, b, 'member') on conflict do nothing;
  end if;
  select email into eb from auth.users where id = b;

  insert into public.redial_lines (owner_id, number) values (a, '+15550000061') returning id into la;
  insert into public.redial_lines (owner_id, number) values (a, '+15550000062') returning id into lb;
  insert into public.redial_calls (line_id, owner_id, status, from_number) values (la, a, 'screening', '+14805550111') returning id into ca;
  insert into public.redial_live_sessions (call_id, line_id, conference_name, state, ai_state) values (ca, la, 'redial-x1', 'live', 'active');

  -- Owner edits the directory and transfers
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.redial_directory (line_id, label, number, note) values (la, 'Office', '+14805550123', 'Billing questions') returning id into d;
  r := r || E'1a owner adds a destination [ok]\n';
  begin perform public.redial_transfer_start(ca, null, '+15550000062', true); r := r || E'1b transfer to another Redial line ALLOWED (FAIL)\n';
  exception when others then r := r || E'1b loop to a Redial line refused [ok]\n'; end;
  begin perform public.redial_transfer_start(ca, null, '+14805550111', true); r := r || E'1c transfer back to the caller ALLOWED (FAIL)\n';
  exception when others then r := r || E'1c loop to the caller refused [ok]\n'; end;
  begin perform public.redial_transfer_start(ca, null, '+14805550199', false); r := r || E'1d unconfirmed one-time number ALLOWED (FAIL)\n';
  exception when others then r := r || E'1d one-time number needs confirming [ok]\n'; end;
  select transfer_id into t from public.redial_transfer_start(ca, d, null, false); r := r || E'1e owner transfers to a saved destination [ok]\n';
  begin perform public.redial_transfer_start(ca, d, null, false); r := r || E'1f second transfer at once ALLOWED (FAIL)\n';
  exception when others then r := r || E'1f one transfer at a time [ok]\n'; end;
  begin update public.redial_transfers set status = 'connected' where id = t; get diagnostics n = row_count; r := r || format(E'1g marks connected directly rows=%s (FAIL)\n', n);
  exception when insufficient_privilege then r := r || E'1g can''t mark connected directly [ok]\n'; end;
  perform public.redial_transfer_failed(t, 'test');
  perform public.redial_grant(la, eb, array['read_summary', 'transfer_call']);
  execute 'reset role';
  select count(*) into n from public.redial_transfers where id = t and status = 'failed'; r := r || format(E'1h requester marks own failed=%s [1]\n', n);

  -- B can transfer to saved numbers only, and can't edit the directory
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_directory where line_id = la; r := r || format(E'2a transferer sees the directory=%s [1]\n', n);
  begin insert into public.redial_directory (line_id, label, number) values (la, 'Mine', '+14805550177'); r := r || E'2b transferer edits directory ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2b can''t edit the directory [ok]\n'; end;
  begin perform public.redial_transfer_start(ca, null, '+14805550199', true); r := r || E'2c one-time number without permission ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'2c one-time number needs its own permission [ok]\n'; end;
  perform public.redial_transfer_start(ca, d, null, false); r := r || E'2d transferer uses a saved destination [ok]\n';
  execute 'reset role';

  -- Without transfer_call: no directory, no transfers
  update public.redial_line_grants set capabilities = array['read_summary'] where line_id = la and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.redial_directory where line_id = la; r := r || format(E'3a summaries-only sees directory=%s [0]\n', n);
  select count(*) into n from public.redial_transfers where call_id = ca; r := r || format(E'3b summaries-only sees transfer history=%s [2]\n', n);
  begin perform public.redial_transfer_start(ca, d, null, false); r := r || E'3c summaries-only transfers ALLOWED (FAIL)\n';
  exception when insufficient_privilege then r := r || E'3c summaries-only can''t transfer [ok]\n'; end;
  execute 'reset role';

  raise exception 'RESULTS (rolled back): %', r;
end $$;
