-- Events alongside bookings: one-day (start and end time) or multi-day,
-- in person, online or both, with a public page, registration (capacity
-- limited), and reminders. Staff manage them (crm.view / crm.manage); the
-- public functions show published events and take registrations.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  summary text check (char_length(summary) <= 500),
  description text check (char_length(description) <= 20000),
  location_kind text not null default 'in_person' check (location_kind in ('in_person', 'online', 'hybrid')),
  location text check (char_length(location) <= 300),
  online_url text check (char_length(online_url) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  capacity integer check (capacity is null or capacity between 1 and 100000),
  status text not null default 'draft' check (status in ('draft', 'published', 'canceled')),
  registration_open boolean not null default true,
  host_id uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index events_starts_idx on public.events (starts_at);
create index events_host_idx on public.events (host_id);
create index events_created_by_idx on public.events (created_by);
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 200),
  guests integer not null default 1 check (guests between 1 and 20),
  status text not null default 'registered' check (status in ('registered', 'canceled', 'attended', 'no_show')),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index event_registrations_unique_email on public.event_registrations (event_id, lower(email));
create index event_registrations_contact_idx on public.event_registrations (contact_id);
create index event_registrations_reminder_idx on public.event_registrations (event_id) where reminder_sent_at is null and status = 'registered';

revoke all on public.events, public.event_registrations from anon, authenticated;
grant select, delete on public.events, public.event_registrations to authenticated;
grant insert (title, slug, summary, description, location_kind, location, online_url, starts_at, ends_at, all_day, capacity, status, registration_open, host_id),
      update (title, slug, summary, description, location_kind, location, online_url, starts_at, ends_at, all_day, capacity, status, registration_open, host_id)
  on public.events to authenticated;
grant insert (event_id, name, email, phone, company, guests, status, contact_id), update (name, email, phone, company, guests, status, contact_id)
  on public.event_registrations to authenticated;

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
create policy "events_select" on public.events for select to authenticated using ((select private.staff_can('crm.view')));
create policy "events_write" on public.events for all to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "event_registrations_select" on public.event_registrations for select to authenticated using ((select private.staff_can('crm.view')));
create policy "event_registrations_write" on public.event_registrations for all to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));

-- Published, not-yet-ended events (or one by slug) for the public pages.
create function public.events_public(p_slug text)
returns table (title text, slug text, summary text, description text, location_kind text, location text, starts_at timestamptz, ends_at timestamptz,
               all_day boolean, capacity integer, spots_left integer, registration_open boolean, timezone text)
language sql stable security definer set search_path = '' as $$
  select e.title, e.slug, e.summary, e.description, e.location_kind, e.location, e.starts_at, e.ends_at, e.all_day, e.capacity,
         case when e.capacity is null then null
              else greatest(0, e.capacity - coalesce((select sum(r.guests) from public.event_registrations r where r.event_id = e.id and r.status in ('registered', 'attended')), 0))::int end,
         e.registration_open and e.ends_at > now(),
         coalesce((select value ->> 'timezone' from public.platform_settings where key = 'booking_availability'), 'America/Phoenix')
  from public.events e
  where e.status = 'published' and e.ends_at > now() - interval '1 day' and (p_slug is null or e.slug = p_slug)
  order by e.starts_at;
$$;
revoke execute on function public.events_public(text) from public;
grant execute on function public.events_public(text) to anon, authenticated;

-- Public registration. Checks the event is open and has room, ignores
-- repeat sign-ups from the same email, links or creates the contact (lead,
-- source Event), notifies staff. The online link is sent by email, not shown.
create function public.event_register(p_slug text, p_name text, p_email text, p_phone text, p_company text, p_guests integer)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_guests integer := greatest(1, least(coalesce(p_guests, 1), 20));
  v_taken integer;
  v_contact uuid;
  s record;
begin
  perform pg_advisory_xact_lock(hashtext('event_register'));
  select * into e from public.events where slug = p_slug and status = 'published';
  if e.id is null or not e.registration_open or e.ends_at <= now() then raise exception 'Registration for this event is closed' using errcode = '22023'; end if;
  if v_name = '' then raise exception 'Enter your name' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if exists (select 1 from public.event_registrations where event_id = e.id and lower(email) = v_email and status <> 'canceled') then return 'already'; end if;
  if e.capacity is not null then
    select coalesce(sum(guests), 0) into v_taken from public.event_registrations where event_id = e.id and status in ('registered', 'attended');
    if v_taken + v_guests > e.capacity then raise exception 'Sorry, this event is full' using errcode = '22023'; end if;
  end if;
  select id into v_contact from public.crm_contacts where lower(email) = v_email limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, source, role, lead_status, interest)
    values (split_part(v_name, ' ', 1), nullif(substr(v_name, length(split_part(v_name, ' ', 1)) + 2), ''), v_email,
            left(nullif(trim(p_phone), ''), 40), 'Event', 'lead', 'new', e.title)
    returning id into v_contact;
  end if;
  insert into public.event_registrations (event_id, name, email, phone, company, guests, contact_id)
  values (e.id, v_name, v_email, left(nullif(trim(p_phone), ''), 40), left(nullif(trim(p_company), ''), 200), v_guests, v_contact)
  on conflict (event_id, lower(email)) do update set status = 'registered', guests = excluded.guests;
  insert into public.crm_activities (kind, subject, body, contact_id, due_at) values ('meeting', 'Registered: ' || e.title, 'Event registration', v_contact, e.starts_at);
  for s in select user_id, role from public.platform_staff loop
    if 'crm.view' = any(private.role_permissions(s.role)) and (e.host_id is null or s.user_id = e.host_id or s.role = 'owner') then
      perform private.notify(s.user_id, 'booking', 'New registration: ' || e.title, v_name || case when v_guests > 1 then ' (+' || (v_guests - 1) || ')' else '' end,
        '/admin/bookings?tab=events', '{}'::jsonb);
    end if;
  end loop;
  return 'registered';
end $$;
revoke execute on function public.event_register(text, text, text, text, text, integer) from public;
grant execute on function public.event_register(text, text, text, text, text, integer) to anon, authenticated;
