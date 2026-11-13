-- Redial Live Agents: real people who answer business calls that the Redial
-- AI hands to them. Step 1 of docs/On-Demand-Agents: the public listing
-- (profiles, voice samples, skills catalog), favorites, interest sign-ups
-- (agents and businesses, added to the CRM as leads) and the fee setting.
--
-- Public pages read live profiles with the anon key, so every table here
-- holds only what may be shown publicly. Private details (legal name,
-- résumé, payout data) get their own owner/staff-only table in a later step.

-- 1. Skills catalog (lucide icon names; staff edit it later in Admin).
create table public.live_agent_skills (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  icon text not null check (char_length(icon) between 1 and 40),
  category text not null default 'calls' check (category in ('calls', 'industry', 'follow-up')),
  sort int not null default 0
);
revoke all on public.live_agent_skills from anon, authenticated;
grant select on public.live_agent_skills to anon, authenticated;
alter table public.live_agent_skills enable row level security;
create policy "live_agent_skills_select" on public.live_agent_skills for select to anon, authenticated using (true);

insert into public.live_agent_skills (slug, label, icon, category, sort) values
  ('live-answering', 'Live answering', 'phone-incoming', 'calls', 10),
  ('warm-transfers', 'Warm transfers', 'phone-forwarded', 'calls', 20),
  ('booking', 'Appointment booking', 'calendar-check', 'calls', 30),
  ('bilingual', 'Bilingual', 'languages', 'calls', 40),
  ('support', 'Customer support', 'life-buoy', 'calls', 50),
  ('lead-qualification', 'Lead qualification', 'filter', 'calls', 60),
  ('order-taking', 'Order taking', 'shopping-bag', 'calls', 70),
  ('after-hours', 'After-hours', 'moon', 'calls', 80),
  ('outbound-callbacks', 'Outbound callbacks', 'phone-outgoing', 'calls', 90),
  ('medical-office', 'Medical office', 'stethoscope', 'industry', 100),
  ('legal-intake', 'Legal intake', 'scale', 'industry', 110),
  ('dispatch', 'Home services dispatch', 'wrench', 'industry', 120),
  ('real-estate', 'Real estate', 'house', 'industry', 130),
  ('payments', 'Payments over the phone', 'credit-card', 'industry', 140),
  ('crm-entry', 'CRM entry', 'contact', 'follow-up', 150),
  ('follow-up', 'Email and text follow-up', 'mail', 'follow-up', 160);

-- 2. Profiles.
create table public.live_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete cascade, -- null only for demo profiles
  handle text not null unique check (handle ~ '^[a-z0-9-]{3,40}$'),
  display_name text not null check (char_length(display_name) between 2 and 40), -- first name + last initial
  headline text not null check (char_length(headline) between 4 and 90),
  bio text check (char_length(bio) <= 600),
  city text not null check (char_length(city) <= 60),
  region text not null check (char_length(region) <= 30),
  time_zone text not null default 'America/Phoenix' check (char_length(time_zone) <= 40),
  geo_lat numeric(8, 5) check (geo_lat between -90 and 90), -- already moved about 3 km from the real spot
  geo_lng numeric(8, 5) check (geo_lng between -180 and 180),
  years_experience int not null default 0 check (years_experience between 0 and 60),
  languages text[] not null default array['English'] check (cardinality(languages) between 1 and 8),
  industries text[] not null default '{}' check (cardinality(industries) <= 8),
  skills text[] not null default '{}' check (cardinality(skills) <= 16),
  experience jsonb not null default '[]' check (jsonb_typeof(experience) = 'array'), -- [{title, detail}]
  per_minute_cents int check (per_minute_cents between 10 and 1000),
  hourly_cents int check (hourly_cents between 1000 and 20000),
  retainer_cents int check (retainer_cents between 10000 and 2000000),
  retainer_hours int check (retainer_hours between 5 and 200),
  availability jsonb not null default '{}' check (jsonb_typeof(availability) = 'object'), -- {"mon": ["08:00", "17:00"], ...}
  available_now boolean not null default false,
  avatar_url text check (char_length(avatar_url) <= 500),
  status text not null default 'draft' check (status in ('draft', 'pending', 'live', 'paused', 'suspended')),
  is_demo boolean not null default false,
  indexable boolean not null default true,
  -- Computed by Redial (reviews, engagements, replies) in later steps.
  rating numeric(3, 2) check (rating between 1 and 5),
  review_count int not null default 0,
  engagement_count int not null default 0,
  reply_minutes int,
  badges text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_demo or user_id is not null)
);
create index live_agents_status_idx on public.live_agents (status, available_now);
create trigger live_agents_updated_at before update on public.live_agents
  for each row execute function public.set_updated_at();

revoke all on public.live_agents from anon, authenticated;
grant select on public.live_agents to anon, authenticated;
alter table public.live_agents enable row level security;
create policy "live_agents_select_live" on public.live_agents for select to anon, authenticated
  using (status = 'live');
create policy "live_agents_select_own" on public.live_agents for select to authenticated
  using (user_id = (select auth.uid()));

-- 3. Voice samples (15–30 s clips). Public once approved and the profile is live.
create table public.live_agent_voice_samples (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.live_agents on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  transcript text check (char_length(transcript) <= 600),
  storage_path text not null check (char_length(storage_path) <= 300),
  duration_s numeric(4, 1) check (duration_s > 0 and duration_s <= 31),
  featured boolean not null default false,
  ai_voice boolean not null default false, -- demo clips made with an AI voice are labeled
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index live_agent_voice_samples_agent_idx on public.live_agent_voice_samples (agent_id, sort);
revoke all on public.live_agent_voice_samples from anon, authenticated;
grant select on public.live_agent_voice_samples to anon, authenticated;
alter table public.live_agent_voice_samples enable row level security;
create policy "live_agent_voice_select_public" on public.live_agent_voice_samples for select to anon, authenticated
  using (status = 'approved' and exists (select 1 from public.live_agents a where a.id = agent_id and a.status = 'live'));
create policy "live_agent_voice_select_own" on public.live_agent_voice_samples for select to authenticated
  using (exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid())));

-- 4. Favorites: a workspace's saved Live Agents.
create table public.live_agent_favorites (
  workspace_id uuid not null references public.workspaces on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, agent_id)
);
create index live_agent_favorites_agent_idx on public.live_agent_favorites (agent_id);
create index live_agent_favorites_created_by_idx on public.live_agent_favorites (created_by);
revoke all on public.live_agent_favorites from anon, authenticated;
grant select, insert, delete on public.live_agent_favorites to authenticated;
alter table public.live_agent_favorites enable row level security;
create policy "live_agent_favorites_select" on public.live_agent_favorites for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "live_agent_favorites_insert" on public.live_agent_favorites for insert to authenticated
  with check ((select private.is_member(workspace_id)) and created_by = (select auth.uid()));
create policy "live_agent_favorites_delete" on public.live_agent_favorites for delete to authenticated
  using ((select private.is_member(workspace_id)));

-- 5. Interest: people who want to become Live Agents and businesses that
-- want coverage. Written only by live_agent_interest(); staff read it in
-- the CRM (each entry is linked to a lead).
create table public.live_agent_interest (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('agent', 'business')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  company text,
  city text,
  details jsonb not null default '{}',
  contact_id uuid references public.crm_contacts on delete set null,
  consent_sms boolean not null default false,
  consent_text text,
  created_at timestamptz not null default now()
);
create index live_agent_interest_contact_idx on public.live_agent_interest (contact_id);
revoke all on public.live_agent_interest from anon, authenticated;
alter table public.live_agent_interest enable row level security;
-- No policies: only the function below and staff tools (service role) touch it.

create or replace function public.live_agent_interest(p jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text := case when p->>'kind' = 'business' then 'business' else 'agent' end;
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_first text := left(trim(coalesce(p->>'first_name', '')), 100);
  v_last text := left(trim(coalesce(p->>'last_name', '')), 100);
  v_phone text := nullif(left(trim(coalesce(p->>'phone', '')), 40), '');
  v_company text := nullif(left(trim(coalesce(p->>'company', '')), 200), '');
  v_city text := nullif(left(trim(coalesce(p->>'city', '')), 100), '');
  v_details jsonb := jsonb_build_object(
    'languages', coalesce(p->'languages', '[]'), 'skills', coalesce(p->'skills', '[]'),
    'years', left(coalesce(p->>'years', ''), 10), 'hours', left(coalesce(p->>'hours', ''), 200),
    'note', left(coalesce(p->>'note', ''), 2000), 'source_page', left(coalesce(p->>'source_page', ''), 200));
  v_tag text := case v_kind when 'agent' then 'live-agent-applicant' else 'live-agent-coverage' end;
  v_contact uuid;
  v_entry uuid;
  s record;
begin
  if v_first = '' or v_last = '' then raise exception 'Enter your first and last name.' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  if v_phone is not null and v_phone !~ '^\+[1-9]\d{7,14}$' then raise exception 'Enter a valid phone number.' using errcode = '22023'; end if;
  if (select count(*) from public.live_agent_interest where created_at > now() - interval '1 hour') >= 200
     or exists (select 1 from public.live_agent_interest i where i.email = v_email and i.created_at > now() - interval '1 minute') then
    raise exception 'Too many sign-ups right now. Try again in a minute.' using errcode = '54000';
  end if;

  -- CRM: reuse the contact with this email, otherwise add a lead.
  select c.id into v_contact from public.crm_contacts c where lower(c.email) = v_email order by c.created_at limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, source, role, lead_status, tags, interest, details)
    values (v_first, v_last, v_email, v_phone, case v_kind when 'agent' then 'Live Agent application' else 'Live Agent coverage request' end,
            'lead', 'new', array[v_tag], case v_kind when 'agent' then 'Become a Live Agent' else 'Hire Live Agents' end,
            jsonb_build_object('live_agents', v_details))
    returning id into v_contact;
  else
    update public.crm_contacts c set
      tags = array(select distinct t from unnest(c.tags || array[v_tag]) t),
      phone = coalesce(c.phone, v_phone),
      details = c.details || jsonb_build_object('live_agents', v_details)
    where c.id = v_contact;
  end if;

  insert into public.live_agent_interest (kind, first_name, last_name, email, phone, company, city, details, contact_id, consent_sms, consent_text)
  values (v_kind, v_first, v_last, v_email, v_phone, v_company, v_city, v_details, v_contact,
          coalesce((p->>'consent_sms')::boolean, false), left(p->>'consent_text', 1000))
  returning id into v_entry;

  -- Let staff who handle the CRM know.
  for s in select user_id, role from public.platform_staff loop
    if 'crm.view' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'live_agent_interest',
        case v_kind when 'agent' then 'Live Agent application: ' else 'Live Agent coverage request: ' end || v_first || ' ' || v_last,
        coalesce(v_company, v_city, v_email), '/admin/contacts/' || v_contact, jsonb_build_object('entry_id', v_entry));
    end if;
  end loop;
end $$;
revoke execute on function public.live_agent_interest(jsonb) from public;
grant execute on function public.live_agent_interest(jsonb) to anon, authenticated;

-- 6. Fees: Super Admin sets them in platform_settings ("live_agents");
-- the public pages read just the two percentages.
create or replace function public.live_agent_fees()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'businessFeePercent', coalesce((select (s.value->>'businessFeePercent')::numeric from public.platform_settings s where s.key = 'live_agents'), 10),
    'agentFeePercent', coalesce((select (s.value->>'agentFeePercent')::numeric from public.platform_settings s where s.key = 'live_agents'), 15));
$$;
revoke execute on function public.live_agent_fees() from public;
grant execute on function public.live_agent_fees() to anon, authenticated;

-- 7. Media: profile photos and voice clips. Public read (only approved
-- files are ever linked from a live profile); each agent writes only to
-- their own folder (<user id>/...). Demo files live under demo/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live-agent-media', 'live-agent-media', true, 5242880,
        array['image/webp', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'])
on conflict (id) do nothing;

create policy "live_agent_media_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'live-agent-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "live_agent_media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'live-agent-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'live-agent-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "live_agent_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'live-agent-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "live_agent_media_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'live-agent-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
