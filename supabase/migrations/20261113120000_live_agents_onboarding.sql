-- Live Agents step 2 and 3: people build their own profile (/agent-desk/setup)
-- and send it for review; staff approve or send it back (/admin/live-agents).
--
-- Owners can write only the profile fields (column grants). Status changes
-- are limited by a trigger: draft -> pending (send for review),
-- pending -> draft (withdraw), live <-> paused. Only staff, through
-- review_live_agent(), make a profile live, send it back or suspend it.
-- New voice clips always start "pending" and go public only once approved.

-- 1. Review and progress columns.
alter table public.live_agents
  add column setup_step int not null default 1 check (setup_step between 1 and 8),
  -- Equipment and workspace (slugs from src/lib/live-agents/types.ts), shown
  -- on profiles and used as search filters.
  add column equipment text[] not null default '{}' check (cardinality(equipment) <= 16),
  add column workspace text[] not null default '{}' check (cardinality(workspace) <= 10),
  add column review_note text check (char_length(review_note) <= 1000),
  add column submitted_at timestamptz,
  add column approved_at timestamptz,
  add column reviewed_by uuid references auth.users on delete set null;
create index live_agents_reviewed_by_idx on public.live_agents (reviewed_by);

-- 2. Staff permissions: marketplace.view (see the queue), marketplace.manage
-- (approve, send back, suspend). Same lists as before plus these.
create or replace function private.role_permissions(r public.staff_role) returns text[]
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'staff.manage', 'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage']
    when 'admin' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage']
    when 'support' then array[
      'dashboard.view', 'users.view', 'users.manage', 'workspaces.view', 'notifications.view', 'crm.view', 'crm.manage',
      'comms.view', 'comms.manage', 'projects.manage', 'marketplace.view', 'marketplace.manage']
    when 'finance' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'billing.manage', 'crm.view', 'marketplace.view']
    when 'marketing' then array[
      'dashboard.view', 'analytics.view', 'crm.view', 'crm.manage', 'content.manage',
      'comms.view', 'comms.manage', 'social.manage', 'marketplace.view']
    when 'analyst' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'ai.view']
    else array[]::text[]
  end;
$$;

-- 3. Owners create and edit their own profile.
grant insert (user_id, handle, display_name, headline, city, region, time_zone, geo_lat, geo_lng)
  on public.live_agents to authenticated;
grant update (handle, display_name, headline, bio, city, region, time_zone, geo_lat, geo_lng, years_experience, languages,
              industries, skills, experience, per_minute_cents, hourly_cents, retainer_cents, retainer_hours, availability,
              available_now, avatar_url, status, indexable, setup_step, equipment, workspace)
  on public.live_agents to authenticated;
grant delete on public.live_agents to authenticated;

create policy "live_agents_insert_own" on public.live_agents for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'draft' and not is_demo);
create policy "live_agents_update_own" on public.live_agents for update to authenticated
  using (user_id = (select auth.uid()) and status <> 'suspended')
  with check (user_id = (select auth.uid()));
create policy "live_agents_delete_own" on public.live_agents for delete to authenticated
  using (user_id = (select auth.uid()) and status <> 'suspended');

-- Status changes an owner may make, and the staff notice on "send for review".
create or replace function private.live_agent_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s record;
begin
  if coalesce(current_setting('live_agents.review', true), '') = 'on' then return new; end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'draft' and new.status = 'pending')
         or (old.status = 'pending' and new.status = 'draft')
         or (old.status = 'live' and new.status = 'paused')
         or (old.status = 'paused' and new.status = 'live' and old.approved_at is not null)) then
      raise exception 'That change needs the Redial team.' using errcode = '42501';
    end if;
    if new.status = 'pending' then
      new.submitted_at := now();
      for s in select user_id, role from public.platform_staff loop
        if 'marketplace.manage' = any(private.role_permissions(s.role)) then
          perform private.notify(s.user_id, 'live_agent_submitted', 'Live Agent profile to review: ' || new.display_name,
            new.headline || ' · ' || new.city || ', ' || new.region, '/admin/live-agents', jsonb_build_object('agent_id', new.id));
        end if;
      end loop;
    end if;
  end if;
  -- "Available now" only makes sense on a live profile.
  if new.status <> 'live' then new.available_now := false; end if;
  return new;
end $$;
revoke execute on function private.live_agent_guard() from public, anon, authenticated;
create trigger live_agents_guard before update on public.live_agents
  for each row execute function private.live_agent_guard();

-- 4. Voice clips: owners add (always pending), rename, reorder and delete
-- their own, up to 3. The file must be in their own storage folder.
grant insert (agent_id, title, transcript, storage_path, duration_s, featured, sort) on public.live_agent_voice_samples to authenticated;
grant update (title, transcript, featured, sort) on public.live_agent_voice_samples to authenticated;
grant delete on public.live_agent_voice_samples to authenticated;

create policy "live_agent_voice_insert_own" on public.live_agent_voice_samples for insert to authenticated
  with check (
    split_part(storage_path, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid()) and a.status <> 'suspended'));
create policy "live_agent_voice_update_own" on public.live_agent_voice_samples for update to authenticated
  using (exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid()) and a.status <> 'suspended'))
  with check (exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid())));
create policy "live_agent_voice_delete_own" on public.live_agent_voice_samples for delete to authenticated
  using (exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid()) and a.status <> 'suspended'));

create or replace function private.live_agent_voice_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.live_agent_voice_samples where agent_id = new.agent_id) >= 3 then
    raise exception 'You can have up to 3 voice clips. Delete one first.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function private.live_agent_voice_limit() from public, anon, authenticated;
create trigger live_agent_voice_limit before insert on public.live_agent_voice_samples
  for each row execute function private.live_agent_voice_limit();

-- 5. Staff: the review queue and every listing, with the owner's email.
create or replace function public.admin_live_agents()
returns table (
  id uuid, user_id uuid, email text, handle text, display_name text, headline text, bio text, city text, region text,
  years_experience int, languages text[], industries text[], skills text[], equipment text[], workspace text[], experience jsonb, per_minute_cents int,
  hourly_cents int, retainer_cents int, retainer_hours int, availability jsonb, avatar_url text, status text, is_demo boolean,
  review_note text, submitted_at timestamptz, approved_at timestamptz, created_at timestamptz, updated_at timestamptz, samples jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.view') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select a.id, a.user_id, u.email::text, a.handle, a.display_name, a.headline, a.bio, a.city, a.region, a.years_experience, a.languages,
           a.industries, a.skills, a.equipment, a.workspace, a.experience, a.per_minute_cents, a.hourly_cents, a.retainer_cents, a.retainer_hours, a.availability,
           a.avatar_url, a.status, a.is_demo, a.review_note, a.submitted_at, a.approved_at, a.created_at, a.updated_at,
           coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'transcript', v.transcript, 'storage_path', v.storage_path,
                       'duration_s', v.duration_s, 'status', v.status, 'ai_voice', v.ai_voice) order by v.sort)
                     from public.live_agent_voice_samples v where v.agent_id = a.id), '[]'::jsonb)
    from public.live_agents a
    left join auth.users u on u.id = a.user_id
    order by (a.status = 'pending') desc, a.submitted_at desc nulls last, a.updated_at desc;
end $$;
revoke execute on function public.admin_live_agents() from public, anon;
grant execute on function public.admin_live_agents() to authenticated;

-- approve: profile goes live and its pending clips are approved.
-- return: back to draft with a note for the agent. suspend / restore.
-- approve_clip / reject_clip: one voice clip (target is the clip id).
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
  elsif decision = 'restore' then
    update public.live_agents set status = case when approved_at is not null then 'paused' else 'draft' end, reviewed_by = auth.uid() where id = target;
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.review_live_agent(uuid, text, text) from public, anon;
grant execute on function public.review_live_agent(uuid, text, text) to authenticated;

-- 6. Demo profiles get example equipment and workspaces.
update public.live_agents set equipment = v.e, workspace = v.w
from (values
  ('maya-r', array['laptop', 'usb-headset', 'noise-cancelling', 'webcam', 'wired-internet', 'backup-internet'], array['home-office', 'door-closes', 'dedicated-desk', 'quiet']),
  ('daniel-b', array['desktop', 'second-monitor', 'usb-headset', 'noise-cancelling', 'webcam', 'wired-internet', 'backup-power'], array['home-office', 'door-closes', 'dedicated-desk', 'quiet', 'video-ready']),
  ('sofia-m', array['laptop', 'usb-headset', 'smartphone', 'backup-internet'], array['home-office', 'dedicated-desk', 'quiet']),
  ('alex-m', array['laptop', 'second-monitor', 'usb-headset', 'webcam', 'wired-internet'], array['coworking', 'dedicated-desk', 'video-ready']),
  ('priya-s', array['desktop', 'usb-headset', 'noise-cancelling', 'wired-internet', 'backup-internet', 'backup-power'], array['home-office', 'door-closes', 'dedicated-desk', 'quiet']),
  ('marcus-j', array['laptop', 'usb-headset', 'smartphone', 'landline', 'backup-internet'], array['home-office', 'dedicated-desk']),
  ('grace-l', array['desktop', 'second-monitor', 'usb-headset', 'noise-cancelling', 'webcam', 'wired-internet'], array['home-office', 'door-closes', 'dedicated-desk', 'quiet', 'video-ready']),
  ('luis-h', array['tablet', 'usb-headset', 'smartphone'], array['shared-space'])
) as v(handle, e, w)
where public.live_agents.handle = v.handle and public.live_agents.is_demo;
