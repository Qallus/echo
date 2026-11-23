-- Access-rule check for agent tasks, web search and social posting
-- (migrations 20261124090000, 20261124100000, 20261124110000).
-- Run in the Supabase SQL Editor. Everything it does is rolled back; the one
-- row of output lists each check. Expected:
--   outsider_* = blocked (a signed-in user who isn't staff), outsider_settings_rows = 0 changed
--   owner_* = ok, owner_claim = claimed, second_claim_rows = 0,
--   owner_report = done runs=1, run_rows = 1
-- The owner is the first owner in platform_staff; the outsider is a made-up id.

create temp table if not exists _rls(out text);
truncate _rls;
do $$
declare
  res text := '';
  t uuid;
  r public.agent_tasks;
  owner uuid := (select user_id from public.platform_staff where role = 'owner' limit 1);
  n int;
begin
  begin
    perform set_config('request.jwt.claims', '{"sub":"11111111-2222-4333-8444-555555555555","role":"authenticated","aal":"aal2"}', true);
    execute 'set local role authenticated';
    begin insert into public.agent_tasks(title) values ('x'); res := res || 'outsider_task_insert=ALLOWED; '; exception when others then res := res || 'outsider_task_insert=blocked; '; end;
    begin insert into public.social_posts(body) values ('x'); res := res || 'outsider_post_insert=ALLOWED; '; exception when others then res := res || 'outsider_post_insert=blocked; '; end;
    begin insert into public.social_accounts(provider, external_id, name) values ('linkedin', 'x', 'x'); res := res || 'outsider_account_insert=ALLOWED; '; exception when others then res := res || 'outsider_account_insert=blocked; '; end;
    begin insert into public.web_searches(provider, query) values ('google', 'x'); res := res || 'outsider_search_log=ALLOWED; '; exception when others then res := res || 'outsider_search_log=blocked; '; end;
    begin perform public.agent_task_claim(null); res := res || 'outsider_claim=ALLOWED; '; exception when others then res := res || 'outsider_claim=blocked; '; end;
    begin
      update public.platform_settings set value = '{}' where key = 'web_search';
      get diagnostics n = row_count;
      res := res || 'outsider_settings_rows=' || n || ' changed; ';
    exception when others then res := res || 'outsider_settings=blocked; '; end;
    execute 'reset role';

    perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    execute 'set local role authenticated';
    insert into public.agent_tasks(title, instructions, status, next_run_at) values ('RLS test task', 'x', 'queued', now() - interval '1 minute') returning id into t;
    res := res || 'owner_task_insert=ok; ';
    select * into r from public.agent_task_claim(t);
    res := res || 'owner_claim=' || coalesce(r.status, 'none') || '; ';
    res := res || 'second_claim_rows=' || (select count(*) from public.agent_task_claim(t)) || '; ';
    select * into r from public.agent_task_report(t, true, 'test report', array['/admin'], null);
    res := res || 'owner_report=' || r.status || ' runs=' || r.runs || '; ';
    res := res || 'run_rows=' || (select count(*) from public.agent_task_runs where task_id = t) || '; ';
    insert into public.social_posts(body, status) values ('test', 'draft'); res := res || 'owner_post_insert=ok; ';
    insert into public.web_searches(provider, query) values ('google', 'rls test'); res := res || 'owner_search_log=ok; ';
    insert into public.platform_settings(key, value) values ('web_search', '{"monthlyCapCents":1000}')
      on conflict (key) do update set value = excluded.value;
    res := res || 'owner_settings=ok; ';
    execute 'reset role';
    raise exception 'rollback_test';
  exception when others then
    if sqlerrm <> 'rollback_test' then res := res || 'ERROR: ' || sqlerrm; end if;
  end;
  insert into _rls values (res);
end $$;
select out from _rls;
