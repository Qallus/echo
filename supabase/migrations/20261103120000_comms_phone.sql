-- Super Admin v2, batch A3 step 2: texts and calls (Twilio) and email
-- automations. Staff only (comms.view / comms.manage). Twilio webhooks verify
-- Twilio's signature and write with the service role; staff write outbound
-- texts and logged calls through server actions.

-- ---------------------------------------------------------------------------
-- Texts
-- ---------------------------------------------------------------------------
create table public.phone_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text not null check (char_length(from_number) <= 40),
  to_number text not null check (char_length(to_number) <= 40),
  body text not null default '' check (char_length(body) <= 2000),
  status text check (char_length(status) <= 40),
  error text check (char_length(error) <= 500),
  twilio_sid text unique check (char_length(twilio_sid) <= 64),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and pg_column_size(media) <= 8192),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index phone_messages_created_idx on public.phone_messages (created_at desc);
create index phone_messages_from_idx on public.phone_messages (from_number, created_at desc);
create index phone_messages_to_idx on public.phone_messages (to_number, created_at desc);
create index phone_messages_contact_idx on public.phone_messages (contact_id);
create index phone_messages_deal_idx on public.phone_messages (deal_id);
create index phone_messages_sent_by_idx on public.phone_messages (sent_by);

-- Numbers that texted STOP. Admin texts to them are refused until START.
create table public.phone_opt_outs (
  number text primary key check (char_length(number) <= 40),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------
create table public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text check (char_length(from_number) <= 64),
  to_number text check (char_length(to_number) <= 64),
  status text not null default 'ringing' check (char_length(status) <= 40),
  duration_seconds integer check (duration_seconds >= 0),
  twilio_sid text unique check (char_length(twilio_sid) <= 64),
  recording_path text check (char_length(recording_path) <= 400),
  recording_seconds integer,
  voicemail boolean not null default false,
  transcript text check (char_length(transcript) <= 200000),
  transcript_status text check (transcript_status in ('pending', 'done', 'failed')),
  notes text check (char_length(notes) <= 10000),
  staff_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  activity_id uuid references public.crm_activities (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index phone_calls_created_idx on public.phone_calls (created_at desc);
create index phone_calls_staff_idx on public.phone_calls (staff_id);
create index phone_calls_contact_idx on public.phone_calls (contact_id);
create index phone_calls_deal_idx on public.phone_calls (deal_id);
create index phone_calls_activity_idx on public.phone_calls (activity_id);

revoke all on public.phone_messages, public.phone_opt_outs, public.phone_calls from anon, authenticated;
grant select on public.phone_messages, public.phone_opt_outs, public.phone_calls to authenticated;
grant insert (direction, from_number, to_number, body, status, error, twilio_sid, contact_id, deal_id) on public.phone_messages to authenticated;
grant update (read_at, contact_id) on public.phone_messages to authenticated;
grant update (notes, contact_id, deal_id, activity_id) on public.phone_calls to authenticated;
grant delete on public.phone_calls to authenticated;

alter table public.phone_messages enable row level security;
alter table public.phone_opt_outs enable row level security;
alter table public.phone_calls enable row level security;

create policy "phone_messages_select" on public.phone_messages for select to authenticated using ((select private.staff_can('comms.view')));
create policy "phone_messages_insert" on public.phone_messages for insert to authenticated
  with check ((select private.staff_can('comms.manage')) and direction = 'outbound');
create policy "phone_messages_update" on public.phone_messages for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "phone_opt_outs_select" on public.phone_opt_outs for select to authenticated using ((select private.staff_can('comms.view')));
create policy "phone_calls_select" on public.phone_calls for select to authenticated using ((select private.staff_can('comms.view')));
create policy "phone_calls_update" on public.phone_calls for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "phone_calls_delete" on public.phone_calls for delete to authenticated using ((select private.staff_can('comms.manage')));

-- ---------------------------------------------------------------------------
-- Call recordings: a private bucket, staff with comms.view can play them.
-- Path: <call id>.<ext>. Written only by the signed recording webhook.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('call-recordings', 'call-recordings', false, 104857600, array['audio/mpeg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;
create policy "call_recordings_select" on storage.objects for select to authenticated
  using (bucket_id = 'call-recordings' and (select private.staff_can('comms.view')));

-- New inbound texts and missed calls notify staff who can see communications.
create function private.phone_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record; v_title text; v_body text;
begin
  if tg_table_name = 'phone_messages' then
    if new.direction <> 'inbound' then return null; end if;
    v_title := 'New text from ' || new.from_number;
    v_body := left(new.body, 200);
  else
    if not new.voicemail then return null; end if;
    v_title := 'Voicemail from ' || coalesce(new.from_number, 'unknown');
    v_body := 'Listen in Communications → Calls.';
  end if;
  for s in select user_id, role from public.platform_staff loop
    if 'comms.view' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'phone_message', v_title, v_body,
        case when tg_table_name = 'phone_messages' then '/admin/communications?tab=texts' else '/admin/communications?tab=calls' end, '{}'::jsonb);
    end if;
  end loop;
  return null;
end $$;
revoke execute on function private.phone_notify() from public, anon, authenticated;
create trigger phone_messages_notify after insert on public.phone_messages for each row execute function private.phone_notify();
create trigger phone_calls_voicemail_notify after update of voicemail on public.phone_calls
  for each row when (new.voicemail and not old.voicemail) execute function private.phone_notify();

-- ---------------------------------------------------------------------------
-- Email automations: "when <trigger> (optionally at <stage>), send <template>
-- to <contact | owner>", after an optional delay. CRM actions queue runs;
-- /api/cron/comms sends them when due. Each (automation, run_key) runs once.
-- ---------------------------------------------------------------------------
create table public.email_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  trigger text not null check (trigger in ('lead_created', 'added_to_pipeline', 'stage_changed', 'closed_won', 'closed_lost', 'next_step_overdue', 'deal_stalled')),
  stage text check (stage in ('new_working', 'contacted', 'qualified', 'opportunity', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture')),
  stalled_days integer not null default 14 check (stalled_days between 1 and 365),
  template_id uuid not null references public.email_templates (id) on delete cascade,
  recipient text not null default 'contact' check (recipient in ('contact', 'owner')),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 525600),
  enabled boolean not null default true,
  runs integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_automations_trigger_idx on public.email_automations (trigger) where enabled;
create index email_automations_template_idx on public.email_automations (template_id);
create index email_automations_created_by_idx on public.email_automations (created_by);
create trigger email_automations_updated_at before update on public.email_automations
  for each row execute function public.set_updated_at();

create table public.email_automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.email_automations (id) on delete cascade,
  run_key text not null check (char_length(run_key) <= 200),
  deal_id uuid references public.crm_deals (id) on delete cascade,
  contact_id uuid references public.crm_contacts (id) on delete cascade,
  run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now(),
  unique (automation_id, run_key)
);
create index email_automation_runs_due_idx on public.email_automation_runs (run_at) where status = 'queued';
create index email_automation_runs_deal_idx on public.email_automation_runs (deal_id);
create index email_automation_runs_contact_idx on public.email_automation_runs (contact_id);

revoke all on public.email_automations, public.email_automation_runs from anon, authenticated;
grant select, delete on public.email_automations to authenticated;
grant insert (name, trigger, stage, stalled_days, template_id, recipient, delay_minutes, enabled),
      update (name, trigger, stage, stalled_days, template_id, recipient, delay_minutes, enabled)
  on public.email_automations to authenticated;
grant select, insert (automation_id, run_key, deal_id, contact_id, run_at) on public.email_automation_runs to authenticated;

alter table public.email_automations enable row level security;
alter table public.email_automation_runs enable row level security;
create policy "email_automations_select" on public.email_automations for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_automations_insert" on public.email_automations for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "email_automations_update" on public.email_automations for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "email_automations_delete" on public.email_automations for delete to authenticated using ((select private.staff_can('comms.manage')));
create policy "email_automation_runs_select" on public.email_automation_runs for select to authenticated using ((select private.staff_can('comms.view')));
-- CRM staff queue runs when they move deals or add leads.
create policy "email_automation_runs_insert" on public.email_automation_runs for insert to authenticated with check ((select private.staff_can('crm.manage')));

-- Which staff roles hold a permission (incoming calls ring everyone with
-- comms.manage). Server only.
create function public.staff_roles_with(p_permission text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(r::text), '{}') from unnest(enum_range(null::public.staff_role)) r
  where p_permission = any(private.role_permissions(r));
$$;
revoke execute on function public.staff_roles_with(text) from public, anon, authenticated;
grant execute on function public.staff_roles_with(text) to service_role;
