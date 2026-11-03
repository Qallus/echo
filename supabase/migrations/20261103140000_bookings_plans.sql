-- Super Admin v2, batch B: bookings (appointment types, availability, a
-- public booking page, reminders), plans (task boards from templates), the
-- clients map (geocoded addresses) and the team directory. Staff only, except
-- the two public booking functions.

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.booking_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  description text check (char_length(description) <= 1000),
  minutes integer not null default 30 check (minutes between 5 and 480),
  location text not null default 'video' check (location in ('phone', 'video', 'in_person')),
  location_detail text check (char_length(location_detail) <= 300),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  min_notice_hours integer not null default 4 check (min_notice_hours between 0 and 720),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  host_id uuid references auth.users (id) on delete set null,
  color text not null default 'sky' check (char_length(color) <= 20),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_types_host_idx on public.booking_types (host_id);
create trigger booking_types_updated_at before update on public.booking_types for each row execute function public.set_updated_at();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  type_id uuid references public.booking_types (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'completed', 'canceled', 'no_show')),
  name text not null check (char_length(name) between 1 and 200),
  email text check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 200),
  notes text check (char_length(notes) <= 5000),
  location text check (char_length(location) <= 300),
  source text not null default 'dashboard' check (source in ('website', 'dashboard')),
  host_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  company_id uuid references public.crm_companies (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  reminder_sent_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index bookings_starts_idx on public.bookings (starts_at);
create index bookings_type_idx on public.bookings (type_id);
create index bookings_host_idx on public.bookings (host_id);
create index bookings_contact_idx on public.bookings (contact_id);
create index bookings_company_idx on public.bookings (company_id);
create index bookings_deal_idx on public.bookings (deal_id);
create index bookings_created_by_idx on public.bookings (created_by);
create index bookings_reminder_idx on public.bookings (starts_at) where reminder_sent_at is null and status in ('pending', 'confirmed');
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

revoke all on public.booking_types, public.bookings from anon, authenticated;
grant select, delete on public.booking_types, public.bookings to authenticated;
grant insert (name, slug, description, minutes, location, location_detail, buffer_minutes, min_notice_hours, max_days_ahead, host_id, color, active, sort),
      update (name, slug, description, minutes, location, location_detail, buffer_minutes, min_notice_hours, max_days_ahead, host_id, color, active, sort)
  on public.booking_types to authenticated;
grant insert (type_id, title, starts_at, ends_at, status, name, email, phone, company, notes, location, host_id, contact_id, company_id, deal_id),
      update (type_id, title, starts_at, ends_at, status, name, email, phone, company, notes, location, host_id, contact_id, company_id, deal_id)
  on public.bookings to authenticated;

alter table public.booking_types enable row level security;
alter table public.bookings enable row level security;
create policy "booking_types_select" on public.booking_types for select to authenticated using ((select private.staff_can('crm.view')));
create policy "booking_types_write" on public.booking_types for all to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "bookings_select" on public.bookings for select to authenticated using ((select private.staff_can('crm.view')));
create policy "bookings_insert" on public.bookings for insert to authenticated with check ((select private.staff_can('crm.manage')));
create policy "bookings_update" on public.bookings for update to authenticated
  using ((select private.staff_can('crm.manage'))) with check ((select private.staff_can('crm.manage')));
create policy "bookings_delete" on public.bookings for delete to authenticated using ((select private.staff_can('crm.manage')));

-- Weekly hours, time zone and days off, in platform_settings "booking_availability".
insert into public.platform_settings (key, value) values ('booking_availability', '{
  "timezone": "America/Phoenix",
  "days": {"1": ["09:00", "16:00"], "2": ["09:00", "16:00"], "3": ["09:00", "16:00"], "4": ["09:00", "16:00"], "5": ["09:00", "16:00"]},
  "blackout": []
}') on conflict (key) do nothing;
create policy "settings_insert_booking" on public.platform_settings for insert to authenticated
  with check (key = 'booking_availability' and private.staff_can('crm.manage'));
create policy "settings_update_booking" on public.platform_settings for update to authenticated
  using (key = 'booking_availability' and private.staff_can('crm.manage')) with check (key = 'booking_availability' and private.staff_can('crm.manage'));

-- Open start times for a booking type between two dates (public). 15-minute
-- steps inside the weekly hours, in the configured time zone, skipping days
-- off, times too soon (min notice), too far out, and anything overlapping an
-- existing booking (plus the buffer).
create function public.booking_slots(p_slug text, p_from date, p_to date)
returns table (starts_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.booking_types;
  cfg jsonb;
  tz text;
  d date;
  hours jsonb;
  s timestamptz;
  e timestamptz;
  last_day date;
begin
  select * into t from public.booking_types where slug = p_slug and active;
  if t.id is null then return; end if;
  select value into cfg from public.platform_settings where key = 'booking_availability';
  tz := coalesce(cfg ->> 'timezone', 'America/Phoenix');
  last_day := least(p_to, (now() at time zone tz)::date + t.max_days_ahead, p_from + 62);
  d := greatest(p_from, (now() at time zone tz)::date);
  while d <= last_day loop
    hours := cfg -> 'days' -> extract(isodow from d)::text;
    if hours is not null and jsonb_array_length(hours) = 2 and not coalesce(cfg -> 'blackout', '[]'::jsonb) ? d::text then
      s := (d + (hours ->> 0)::time) at time zone tz;
      e := (d + (hours ->> 1)::time) at time zone tz;
      while s + make_interval(mins => t.minutes) <= e loop
        if s >= now() + make_interval(hours => t.min_notice_hours)
           and not exists (
             select 1 from public.bookings b
             where b.status in ('pending', 'confirmed')
               and b.starts_at < s + make_interval(mins => t.minutes + t.buffer_minutes)
               and b.ends_at + make_interval(mins => t.buffer_minutes) > s) then
          starts_at := s;
          return next;
        end if;
        s := s + interval '15 minutes';
      end loop;
    end if;
    d := d + 1;
  end loop;
end $$;
revoke execute on function public.booking_slots(text, date, date) from public;
grant execute on function public.booking_slots(text, date, date) to anon, authenticated;

-- Public booking (the /book page). Re-checks the slot, links or creates the
-- contact (as a lead), puts a meeting on their timeline, notifies staff.
-- At most 3 bookings per email address per day.
create function public.book_appointment(p_slug text, p_starts_at timestamptz, p_name text, p_email text, p_phone text, p_company text, p_notes text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.booking_types;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_contact uuid;
  v_id uuid;
  v_tz text;
  s record;
begin
  -- One booking at a time, so two people can't take the same slot at once.
  perform pg_advisory_xact_lock(hashtext('book_appointment'));
  select * into t from public.booking_types where slug = p_slug and active;
  if t.id is null then raise exception 'That appointment type is no longer available' using errcode = '22023'; end if;
  select coalesce(value ->> 'timezone', 'America/Phoenix') into v_tz from public.platform_settings where key = 'booking_availability';
  if v_name = '' then raise exception 'Enter your name' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if (select count(*) from public.bookings where lower(email) = v_email and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many bookings today. Please contact us instead.' using errcode = '54000';
  end if;
  if not exists (select 1 from public.booking_slots(p_slug, (p_starts_at at time zone 'UTC')::date - 1, (p_starts_at at time zone 'UTC')::date + 1) x where x.starts_at = p_starts_at) then
    raise exception 'That time was just taken. Please pick another.' using errcode = '22023';
  end if;
  select id into v_contact from public.crm_contacts where lower(email) = v_email limit 1;
  if v_contact is null then
    insert into public.crm_contacts (first_name, last_name, email, phone, source, role, lead_status, interest, owner_id)
    values (split_part(v_name, ' ', 1), nullif(substr(v_name, length(split_part(v_name, ' ', 1)) + 2), ''), v_email,
            left(nullif(trim(p_phone), ''), 40), 'Website booking', 'lead', 'new', t.name, t.host_id)
    returning id into v_contact;
  end if;
  insert into public.bookings (type_id, title, starts_at, ends_at, status, name, email, phone, company, notes, location, source, host_id, contact_id, created_by)
  values (t.id, t.name || ' with ' || v_name, p_starts_at, p_starts_at + make_interval(mins => t.minutes), 'confirmed', v_name, v_email,
          left(nullif(trim(p_phone), ''), 40), left(nullif(trim(p_company), ''), 200), left(nullif(trim(p_notes), ''), 5000),
          coalesce(t.location_detail, t.location), 'website', t.host_id, v_contact, null)
  returning id into v_id;
  insert into public.crm_activities (kind, body, subject, contact_id, occurred_at, due_at)
  values ('meeting', coalesce(nullif(trim(p_notes), ''), 'Booked online'), t.name || ' (booked online)', v_contact, now(), p_starts_at);
  for s in select user_id, role from public.platform_staff loop
    if 'crm.view' = any(private.role_permissions(s.role)) and (t.host_id is null or s.user_id = t.host_id or s.role = 'owner') then
      perform private.notify(s.user_id, 'booking', 'New booking: ' || t.name, v_name || ' · ' || to_char(p_starts_at at time zone coalesce(v_tz, 'America/Phoenix'), 'Dy Mon DD, HH12:MI AM'),
        '/admin/bookings', jsonb_build_object('booking_id', v_id));
    end if;
  end loop;
  return v_id;
end $$;
revoke execute on function public.book_appointment(text, timestamptz, text, text, text, text, text) from public;
grant execute on function public.book_appointment(text, timestamptz, text, text, text, text, text) to anon, authenticated;

-- What the public page may show about a type (active ones only).
create function public.booking_type_public(p_slug text)
returns table (name text, slug text, description text, minutes integer, location text, timezone text)
language sql stable security definer set search_path = '' as $$
  select t.name, t.slug, t.description, t.minutes, t.location,
         coalesce((select value ->> 'timezone' from public.platform_settings where key = 'booking_availability'), 'America/Phoenix')
  from public.booking_types t where t.active and (p_slug is null or t.slug = p_slug) order by t.sort, t.name;
$$;
revoke execute on function public.booking_type_public(text) from public;
grant execute on function public.booking_type_public(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text check (char_length(description) <= 5000),
  color text not null default 'slate' check (char_length(color) <= 20),
  status text not null default 'active' check (status in ('active', 'archived')),
  default_view text not null default 'board' check (default_view in ('board', 'list', 'grid', 'calendar')),
  company_id uuid references public.crm_companies (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  start_date date,
  due_date date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_company_idx on public.plans (company_id);
create index plans_deal_idx on public.plans (deal_id);
create index plans_owner_idx on public.plans (owner_id);
create index plans_created_by_idx on public.plans (created_by);
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();

create table public.plan_groups (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position integer not null default 0,
  color text check (char_length(color) <= 20)
);
create index plan_groups_plan_idx on public.plan_groups (plan_id, position);

create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  group_id uuid references public.plan_groups (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  notes text check (char_length(notes) <= 20000),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'waiting', 'blocked', 'complete')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references auth.users (id) on delete set null,
  start_date date,
  due_date date,
  position integer not null default 0,
  is_milestone boolean not null default false,
  labels text[] not null default '{}' check (cardinality(labels) <= 10),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and pg_column_size(checklist) <= 16384),
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_tasks_plan_idx on public.plan_tasks (plan_id, position);
create index plan_tasks_group_idx on public.plan_tasks (group_id);
create index plan_tasks_assignee_idx on public.plan_tasks (assignee_id) where status <> 'complete';
create index plan_tasks_created_by_idx on public.plan_tasks (created_by);
create trigger plan_tasks_updated_at before update on public.plan_tasks for each row execute function public.set_updated_at();

create function private.plan_task_completed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'complete' and (tg_op = 'INSERT' or old.status <> 'complete') then new.completed_at := now();
  elsif new.status <> 'complete' then new.completed_at := null; end if;
  return new;
end $$;
revoke execute on function private.plan_task_completed() from public, anon, authenticated;
create trigger plan_tasks_completed before insert or update of status on public.plan_tasks for each row execute function private.plan_task_completed();

revoke all on public.plans, public.plan_groups, public.plan_tasks from anon, authenticated;
grant select, delete on public.plans, public.plan_groups, public.plan_tasks to authenticated;
grant insert (name, description, color, status, default_view, company_id, deal_id, owner_id, start_date, due_date),
      update (name, description, color, status, default_view, company_id, deal_id, owner_id, start_date, due_date) on public.plans to authenticated;
grant insert (plan_id, name, position, color), update (name, position, color) on public.plan_groups to authenticated;
grant insert (plan_id, group_id, title, notes, status, priority, assignee_id, start_date, due_date, position, is_milestone, labels, checklist),
      update (group_id, title, notes, status, priority, assignee_id, start_date, due_date, position, is_milestone, labels, checklist) on public.plan_tasks to authenticated;

alter table public.plans enable row level security;
alter table public.plan_groups enable row level security;
alter table public.plan_tasks enable row level security;
-- Anyone on staff with CRM access reads plans; CRM managers and project staff edit.
create policy "plans_select" on public.plans for select to authenticated using ((select private.staff_can('crm.view')));
create policy "plans_write" on public.plans for all to authenticated
  using ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')))
  with check ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')));
create policy "plan_groups_select" on public.plan_groups for select to authenticated using ((select private.staff_can('crm.view')));
create policy "plan_groups_write" on public.plan_groups for all to authenticated
  using ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')))
  with check ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')));
create policy "plan_tasks_select" on public.plan_tasks for select to authenticated using ((select private.staff_can('crm.view')));
create policy "plan_tasks_write" on public.plan_tasks for all to authenticated
  using ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')))
  with check ((select private.staff_can('crm.manage') or private.staff_can('projects.manage')));

-- ---------------------------------------------------------------------------
-- Clients map: geocoded addresses (filled by the app on save)
-- ---------------------------------------------------------------------------
alter table public.crm_companies add column latitude double precision, add column longitude double precision, add column geocoded_address text;
grant update (latitude, longitude, geocoded_address) on public.crm_companies to authenticated;

-- ---------------------------------------------------------------------------
-- Team directory: staff with their role, photo and title (crm.view)
-- ---------------------------------------------------------------------------
drop function public.crm_staff();
create function public.crm_staff()
returns table (user_id uuid, name text, email text, role public.staff_role, avatar_url text, job_title text, phone text, last_sign_in_at timestamptz, mfa boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('crm.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select s.user_id, coalesce(nullif(p.full_name, ''), u.email::text), u.email::text, s.role, p.avatar_url, p.job_title, p.phone, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = s.user_id and f.status = 'verified')
    from public.platform_staff s
    join auth.users u on u.id = s.user_id
    left join public.profiles p on p.id = s.user_id
    order by 2;
end $$;
revoke execute on function public.crm_staff() from public, anon;
grant execute on function public.crm_staff() to authenticated;
