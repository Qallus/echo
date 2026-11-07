-- Scheduled email and text sends. Staff (comms.manage) schedule and cancel;
-- the 5-minute job (/api/cron/comms, service role) claims due rows and sends
-- them. The recipient list is captured when it's scheduled; people who
-- unsubscribe, bounce or text STOP before then are still skipped.

create table public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms')),
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'partial', 'failed', 'canceled')),
  label text check (char_length(label) <= 300),
  subject text check (char_length(subject) <= 300),
  -- email: { templateId | subject/body/html, revision }; sms: { body, kind, topic }
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 262144),
  recipients jsonb not null default '[]' check (jsonb_typeof(recipients) = 'array' and pg_column_size(recipients) <= 4194304),
  total integer not null default 0 check (total >= 0),
  sent integer not null default 0 check (sent >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  failed integer not null default 0 check (failed >= 0),
  progress integer not null default 0 check (progress >= 0),
  error text check (char_length(error) <= 1000),
  campaign_id uuid references public.email_campaigns (id) on delete set null,
  via text not null default 'admin' check (via in ('admin', 'claude')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  canceled_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index scheduled_sends_due_idx on public.scheduled_sends (status, send_at);
create index scheduled_sends_created_idx on public.scheduled_sends (created_at desc);
create index scheduled_sends_created_by_idx on public.scheduled_sends (created_by);
create index scheduled_sends_canceled_by_idx on public.scheduled_sends (canceled_by);
create index scheduled_sends_campaign_idx on public.scheduled_sends (campaign_id);

revoke all on public.scheduled_sends from anon, authenticated;
grant select on public.scheduled_sends to authenticated;
grant insert (channel, send_at, label, subject, content, recipients, total, via) on public.scheduled_sends to authenticated;
grant update (status, canceled_by) on public.scheduled_sends to authenticated;
alter table public.scheduled_sends enable row level security;
create policy "scheduled_sends_select" on public.scheduled_sends for select to authenticated using ((select private.staff_can('comms.view')));
create policy "scheduled_sends_insert" on public.scheduled_sends for insert to authenticated
  with check ((select private.staff_can('comms.manage')) and created_by = (select auth.uid()) and status = 'scheduled');
-- Staff can only cancel something that hasn't started.
create policy "scheduled_sends_cancel" on public.scheduled_sends for update to authenticated
  using ((select private.staff_can('comms.manage')) and status = 'scheduled')
  with check (status = 'canceled' and canceled_by = (select auth.uid()));

-- Texts sent by a scheduled send (also how per-person text frequency is checked).
alter table public.phone_messages add column scheduled_id uuid references public.scheduled_sends (id) on delete set null;
create index phone_messages_scheduled_idx on public.phone_messages (scheduled_id);
create index phone_messages_bulk_to_idx on public.phone_messages (to_number, created_at desc) where scheduled_id is not null;
