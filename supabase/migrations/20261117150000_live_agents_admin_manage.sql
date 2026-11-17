-- Live Agents admin: manage many agents at once.
--  * A new "archived" status (hidden everywhere, restorable).
--  * admin_live_agents() also returns phone, time zone, map spot, rating and
--    work counts for the list, table, cards, map and calendar views.
--  * review_live_agent() learns archive / unarchive.
--  * admin_update_live_agent(): staff edit a profile's details.
--  * admin_delete_live_agent(): delete a profile with no paid work.
--  * admin_live_agent_notify(): a message from the Redial team to agents'
--    notifications (in-app, plus email/SMS by each agent's own settings).
-- Every function checks marketplace.view / marketplace.manage (MFA session).

-- 1. Archived status.
alter table public.live_agents drop constraint if exists live_agents_status_check;
alter table public.live_agents add constraint live_agents_status_check
  check (status in ('draft', 'pending', 'live', 'paused', 'suspended', 'archived'));

-- Archived profiles are locked for their owner, like suspended ones.
drop policy if exists "live_agents_update_own" on public.live_agents;
create policy "live_agents_update_own" on public.live_agents for update to authenticated
  using (user_id = (select auth.uid()) and status not in ('suspended', 'archived'))
  with check (user_id = (select auth.uid()));
drop policy if exists "live_agents_delete_own" on public.live_agents;
create policy "live_agents_delete_own" on public.live_agents for delete to authenticated
  using (user_id = (select auth.uid()) and status not in ('suspended', 'archived'));

-- 2. The staff list, with more columns. (Return type changes, so drop first.)
drop function if exists public.admin_live_agents();
create function public.admin_live_agents()
returns table (
  id uuid, user_id uuid, email text, phone text, handle text, display_name text, headline text, bio text, city text, region text, time_zone text,
  geo_lat numeric, geo_lng numeric, years_experience int, languages text[], industries text[], skills text[], equipment text[], workspace text[],
  experience jsonb, per_minute_cents int, hourly_cents int, retainer_cents int, retainer_hours int, availability jsonb, available_now boolean,
  avatar_url text, status text, is_demo boolean, rating numeric, review_count int, engagement_count int,
  review_note text, submitted_at timestamptz, approved_at timestamptz, created_at timestamptz, updated_at timestamptz, samples jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.view') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.user_id, u.email::text, p.phone, a.handle, a.display_name, a.headline, a.bio, a.city, a.region, a.time_zone,
           a.geo_lat, a.geo_lng, a.years_experience, a.languages, a.industries, a.skills, a.equipment, a.workspace,
           a.experience, a.per_minute_cents, a.hourly_cents, a.retainer_cents, a.retainer_hours, a.availability, a.available_now,
           a.avatar_url, a.status, a.is_demo, a.rating, a.review_count, a.engagement_count,
           a.review_note, a.submitted_at, a.approved_at, a.created_at, a.updated_at,
           coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'transcript', v.transcript, 'storage_path', v.storage_path,
                       'duration_s', v.duration_s, 'status', v.status, 'ai_voice', v.ai_voice) order by v.sort)
                     from public.live_agent_voice_samples v where v.agent_id = a.id), '[]'::jsonb)
    from public.live_agents a
    left join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by (a.status = 'pending') desc, a.submitted_at desc nulls last, a.updated_at desc;
end $$;
revoke execute on function public.admin_live_agents() from public, anon;
grant execute on function public.admin_live_agents() to authenticated;

-- 3. Review decisions, now with archive / unarchive.
create or replace function public.review_live_agent(target uuid, decision text, note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.live_agents;
  v_agent uuid;
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform set_config('live_agents.review', 'on', true);

  if decision in ('approve_clip', 'reject_clip') then
    update public.live_agent_voice_samples set status = case decision when 'approve_clip' then 'approved' else 'rejected' end
      where id = target returning agent_id into v_agent;
    if v_agent is null then raise exception 'Clip not found' using errcode = 'P0002'; end if;
    return;
  end if;

  select * into a from public.live_agents where id = target for update;
  if a.id is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;

  if decision = 'approve' then
    update public.live_agents set status = 'live', approved_at = coalesce(approved_at, now()), review_note = null, reviewed_by = auth.uid() where id = target;
    update public.live_agent_voice_samples set status = 'approved' where agent_id = target and status = 'pending';
    if a.user_id is not null then
      perform private.notify(a.user_id, 'live_agent_review', 'Your Live Agent profile is live',
        'Businesses can now find you on Redial Live Agents.', '/agent-desk', jsonb_build_object('agent_id', target));
    end if;
  elsif decision = 'return' then
    if coalesce(trim(note), '') = '' then raise exception 'Add a note so they know what to change.' using errcode = '22023'; end if;
    update public.live_agents set status = 'draft', review_note = left(note, 1000), reviewed_by = auth.uid() where id = target;
    if a.user_id is not null then
      perform private.notify(a.user_id, 'live_agent_review', 'Your Live Agent profile needs a few changes',
        left(note, 300), '/agent-desk', jsonb_build_object('agent_id', target));
    end if;
  elsif decision = 'suspend' then
    update public.live_agents set status = 'suspended', review_note = nullif(left(coalesce(note, ''), 1000), ''), reviewed_by = auth.uid() where id = target;
  elsif decision = 'archive' then
    update public.live_agents set status = 'archived', reviewed_by = auth.uid() where id = target;
  elsif decision in ('restore', 'unarchive') then
    update public.live_agents set status = case when approved_at is not null then 'paused' else 'draft' end, reviewed_by = auth.uid() where id = target;
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.review_live_agent(uuid, text, text) from public, anon;
grant execute on function public.review_live_agent(uuid, text, text) to authenticated;

-- 4. Staff edit a profile's details. Only the keys present in `patch` change.
create or replace function public.admin_update_live_agent(target uuid, patch jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(patch) <> 'object' then raise exception 'Nothing to change' using errcode = '22023'; end if;
  perform set_config('live_agents.review', 'on', true);
  update public.live_agents set
    display_name     = case when patch ? 'display_name' then patch->>'display_name' else display_name end,
    headline         = case when patch ? 'headline' then patch->>'headline' else headline end,
    bio              = case when patch ? 'bio' then nullif(patch->>'bio', '') else bio end,
    city             = case when patch ? 'city' then patch->>'city' else city end,
    region           = case when patch ? 'region' then patch->>'region' else region end,
    time_zone        = case when patch ? 'time_zone' then patch->>'time_zone' else time_zone end,
    years_experience = case when patch ? 'years_experience' then (patch->>'years_experience')::int else years_experience end,
    languages        = case when patch ? 'languages' then array(select jsonb_array_elements_text(patch->'languages')) else languages end,
    hourly_cents     = case when patch ? 'hourly_cents' then (patch->>'hourly_cents')::int else hourly_cents end,
    per_minute_cents = case when patch ? 'per_minute_cents' then (patch->>'per_minute_cents')::int else per_minute_cents end,
    retainer_cents   = case when patch ? 'retainer_cents' then (patch->>'retainer_cents')::int else retainer_cents end,
    retainer_hours   = case when patch ? 'retainer_hours' then (patch->>'retainer_hours')::int else retainer_hours end,
    review_note      = case when patch ? 'review_note' then nullif(left(patch->>'review_note', 1000), '') else review_note end,
    reviewed_by      = auth.uid()
  where id = target;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end $$;
revoke execute on function public.admin_update_live_agent(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_live_agent(uuid, jsonb) to authenticated;

-- 5. Delete a profile. Refused once there's paid work (keep the money
-- history): archive those instead. The person's Redial account stays.
create or replace function public.admin_delete_live_agent(target uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select display_name into v_name from public.live_agents where id = target;
  if v_name is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.live_agent_payouts where agent_id = target)
     or exists (select 1 from public.live_agent_payments p join public.live_agent_engagements e on e.id = p.engagement_id where e.agent_id = target)
     or exists (select 1 from public.live_agent_engagements where agent_id = target and status in ('active', 'completed')) then
    raise exception '% has paid work on Redial. Archive the profile instead so the payment history stays.', v_name using errcode = '22023';
  end if;
  delete from public.live_agents where id = target;
  return v_name;
end $$;
revoke execute on function public.admin_delete_live_agent(uuid) from public, anon;
grant execute on function public.admin_delete_live_agent(uuid) to authenticated;

-- 6. A message from the Redial team to one or more agents. Returns how many
-- were sent (demo profiles have no account and are skipped).
create or replace function public.admin_live_agent_notify(targets uuid[], title text, body text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if coalesce(trim(title), '') = '' or coalesce(trim(body), '') = '' then raise exception 'Add a title and a message.' using errcode = '22023'; end if;
  if cardinality(targets) > 500 then raise exception 'Send to 500 agents or fewer at a time.' using errcode = '22023'; end if;
  for r in select id, user_id from public.live_agents where id = any(targets) and user_id is not null loop
    perform private.notify(r.user_id, 'live_agent_team', left(trim(title), 200), left(trim(body), 1000), '/agent-desk', jsonb_build_object('agent_id', r.id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.admin_live_agent_notify(uuid[], text, text) from public, anon;
grant execute on function public.admin_live_agent_notify(uuid[], text, text) to authenticated;
