-- Super Admin v2, batch A1: the Channel-Cast pipeline model on Echo's CRM.
-- Nine stages with probabilities, stage checklists, custom fields, stage and
-- owner history, leads as contacts with a role and lead status, and a richer
-- timeline that calls, texts and emails will write into. Staff only, as in
-- 20261102140000_crm_core.sql.

-- ---------------------------------------------------------------------------
-- Deals: stages and workflow state
-- ---------------------------------------------------------------------------
alter table public.crm_deals drop constraint crm_deals_stage_check;
update public.crm_deals set stage = case stage
  when 'lead' then 'new_working' when 'demo' then 'opportunity'
  when 'won' then 'closed_won' when 'lost' then 'closed_lost' else stage end;
alter table public.crm_deals
  alter column stage set default 'new_working',
  add constraint crm_deals_stage_check check (stage in (
    'new_working', 'contacted', 'qualified', 'opportunity', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture')),
  add column probability smallint not null default 10 check (probability between 0 and 100),
  add column opportunity_type text check (char_length(opportunity_type) <= 80),
  add column products text[] not null default '{}' check (cardinality(products) <= 30),
  add column next_step_type text check (next_step_type in ('call', 'email', 'sms', 'meeting', 'demo', 'proposal', 'follow_up', 'contract', 'other')),
  add column next_step_priority text not null default 'normal' check (next_step_priority in ('low', 'normal', 'high')),
  add column stage_entered_at timestamptz not null default now(),
  add column checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object' and pg_column_size(checklist) <= 8192),
  add column extra_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(extra_steps) = 'array' and pg_column_size(extra_steps) <= 8192),
  add column custom_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_fields) = 'array' and pg_column_size(custom_fields) <= 16384),
  add column won_summary text check (char_length(won_summary) <= 2000),
  add column lost_notes text check (char_length(lost_notes) <= 2000),
  add column competitor text check (char_length(competitor) <= 120);
update public.crm_deals set probability = case stage
  when 'new_working' then 10 when 'contacted' then 20 when 'qualified' then 35 when 'opportunity' then 50
  when 'proposal' then 65 when 'negotiation' then 80 when 'closed_won' then 100 when 'closed_lost' then 0 else 10 end,
  stage_entered_at = updated_at;

-- closed_at, stage_entered_at follow the stage.
create or replace function private.crm_deal_closed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_entered_at := now();
    if new.stage in ('closed_won', 'closed_lost') then new.closed_at := now(); else new.closed_at := null; end if;
  end if;
  return new;
end $$;

-- Append-only stage and owner history.
create table public.crm_deal_history (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.crm_deals (id) on delete cascade,
  kind text not null check (kind in ('stage', 'owner')),
  stage text,
  owner_id uuid references auth.users (id) on delete set null,
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index crm_deal_history_deal_idx on public.crm_deal_history (deal_id, created_at desc);
create index crm_deal_history_owner_idx on public.crm_deal_history (owner_id);
create index crm_deal_history_actor_idx on public.crm_deal_history (actor);

revoke all on public.crm_deal_history from anon, authenticated;
grant select on public.crm_deal_history to authenticated;
alter table public.crm_deal_history enable row level security;
create policy "crm_deal_history_select" on public.crm_deal_history for select to authenticated
  using ((select private.staff_can('crm.view')));

create function private.crm_deal_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.crm_deal_history (deal_id, kind, stage, actor) values (new.id, 'stage', new.stage, auth.uid());
  end if;
  if (tg_op = 'INSERT' and new.owner_id is not null) or (tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id) then
    insert into public.crm_deal_history (deal_id, kind, owner_id, actor) values (new.id, 'owner', new.owner_id, auth.uid());
  end if;
  return null;
end $$;
revoke execute on function private.crm_deal_log() from public, anon, authenticated;
create trigger crm_deals_log after insert or update of stage, owner_id on public.crm_deals
  for each row execute function private.crm_deal_log();

-- Existing deals start their history now.
insert into public.crm_deal_history (deal_id, kind, stage, created_at) select id, 'stage', stage, created_at from public.crm_deals;

grant insert (probability, opportunity_type, products, next_step_type, next_step_priority, checklist, extra_steps, custom_fields, won_summary, lost_notes, competitor),
      update (probability, opportunity_type, products, next_step_type, next_step_priority, checklist, extra_steps, custom_fields, won_summary, lost_notes, competitor)
  on public.crm_deals to authenticated;

-- ---------------------------------------------------------------------------
-- Contacts: role, lead status and location
-- ---------------------------------------------------------------------------
alter table public.crm_contacts
  add column role text not null default 'contact' check (role in ('contact', 'lead', 'prospect', 'client', 'partner')),
  add column status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  add column lead_status text check (lead_status in ('new', 'attempting', 'contacted', 'nurture', 'qualified', 'disqualified', 'in_pipeline')),
  add column interest text check (char_length(interest) <= 200),
  add column website text check (char_length(website) <= 300),
  add column address text check (char_length(address) <= 300),
  add column city text check (char_length(city) <= 100),
  add column state text check (char_length(state) <= 100),
  add column zip text check (char_length(zip) <= 20),
  add column details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384);
create index crm_contacts_role_idx on public.crm_contacts (role, lead_status);

grant insert (role, status, lead_status, interest, website, address, city, state, zip, details),
      update (role, status, lead_status, interest, website, address, city, state, zip, details)
  on public.crm_contacts to authenticated;

-- ---------------------------------------------------------------------------
-- Activities: one timeline for notes, tasks, calls, texts and emails
-- ---------------------------------------------------------------------------
alter table public.crm_activities drop constraint crm_activities_kind_check;
alter table public.crm_activities
  add constraint crm_activities_kind_check check (kind in ('note', 'call', 'email', 'sms', 'meeting', 'task', 'voicemail')),
  add column direction text check (direction in ('inbound', 'outbound')),
  add column subject text check (char_length(subject) <= 300),
  add column from_addr text check (char_length(from_addr) <= 200),
  add column to_addr text check (char_length(to_addr) <= 200),
  add column status text check (char_length(status) <= 40),
  add column duration_seconds integer check (duration_seconds >= 0),
  add column external_id text check (char_length(external_id) <= 200),
  add column recording_path text check (char_length(recording_path) <= 400),
  add column transcript text check (char_length(transcript) <= 200000),
  add column ai_summary text check (char_length(ai_summary) <= 10000),
  add column occurred_at timestamptz not null default now();
alter table public.crm_activities drop constraint crm_activities_body_check;
alter table public.crm_activities add constraint crm_activities_body_check check (char_length(body) <= 100000);
update public.crm_activities set occurred_at = created_at;
create unique index crm_activities_external_idx on public.crm_activities (kind, external_id) where external_id is not null;
create index crm_activities_occurred_idx on public.crm_activities (occurred_at desc);

-- Staff log calls, emails and meetings by hand; webhooks fill the rest later.
grant insert (direction, subject, duration_seconds, occurred_at) on public.crm_activities to authenticated;

-- ---------------------------------------------------------------------------
-- Stage guidance and Next Steps, edited in Configure stages
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value) values ('crm_stages', '{}') on conflict (key) do nothing;
create policy "settings_insert_crm_stages" on public.platform_settings for insert to authenticated
  with check (key = 'crm_stages' and private.staff_can('crm.manage'));
create policy "settings_update_crm_stages" on public.platform_settings for update to authenticated
  using (key = 'crm_stages' and private.staff_can('crm.manage')) with check (key = 'crm_stages' and private.staff_can('crm.manage'));
