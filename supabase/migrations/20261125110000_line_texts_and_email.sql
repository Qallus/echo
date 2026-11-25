-- SMS from your own Redial line, and Emails from the user dashboard.
--
-- Texts: phone_messages gets line_id. Texts to and from a customer's Redial
-- line belong to that line: its owner (and people they shared the line with,
-- with the new "send_texts" permission) see and send them. Redial staff's
-- Communications keeps only texts that aren't on a customer line.
--
-- Emails: a workspace's sent log and saved templates. Emails go out through
-- Redial's email service with the sender's name and their reply-to address.

-- 1. Texts on a line -------------------------------------------------------
alter table public.phone_messages add column if not exists line_id uuid references public.redial_lines (id) on delete set null;
create index if not exists phone_messages_line_idx on public.phone_messages (line_id, created_at desc);
grant insert (line_id) on public.phone_messages to authenticated;
grant select (line_id) on public.phone_messages to authenticated;

-- Earlier texts to or from a customer line move to that line.
update public.phone_messages m set line_id = l.id
from public.redial_lines l
where m.line_id is null and l.number = case when m.direction = 'inbound' then m.to_number else m.from_number end;

-- Shared-line permission: send and read texts.
alter table public.redial_line_grants drop constraint redial_line_grants_capabilities_check;
alter table public.redial_line_grants add constraint redial_line_grants_capabilities_check check (
  cardinality(capabilities) between 1 and 12
  and capabilities <@ array['read_summary', 'read_transcript', 'manage_rules', 'monitor_live', 'takeover_live', 'direct_agent',
    'transfer_call', 'manage_directory', 'dial_custom_destination', 'mirror', 'manage_flows', 'send_texts']::text[]);

create or replace function private.can_text_line(p_line uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and (
    exists (select 1 from public.redial_lines l where l.id = p_line and l.owner_id = (select auth.uid()))
    or exists (select 1 from public.redial_line_grants g where g.line_id = p_line and g.user_id = (select auth.uid()) and 'send_texts' = any (g.capabilities)));
$$;
revoke execute on function private.can_text_line(uuid) from public, anon;
grant execute on function private.can_text_line(uuid) to authenticated;

drop policy if exists phone_messages_select on public.phone_messages;
drop policy if exists phone_messages_insert on public.phone_messages;
drop policy if exists phone_messages_update on public.phone_messages;
create policy phone_messages_select on public.phone_messages for select to authenticated
  using (case when line_id is null then (select private.staff_can('comms.view')) else (select private.can_text_line(line_id)) end);
create policy phone_messages_insert on public.phone_messages for insert to authenticated
  with check (direction = 'outbound' and
    case when line_id is null then (select private.staff_can('comms.manage')) else (select private.can_text_line(line_id)) end);
create policy phone_messages_update on public.phone_messages for update to authenticated
  using (case when line_id is null then (select private.staff_can('comms.manage')) else (select private.can_text_line(line_id)) end)
  with check (case when line_id is null then (select private.staff_can('comms.manage')) else (select private.can_text_line(line_id)) end);

-- Which of these numbers replied STOP (texts to them are refused until START).
-- Only answers for people who texted with one of your lines.
create or replace function public.line_opt_outs(p_line uuid, p_numbers text[]) returns setof text
language sql stable security definer set search_path = '' as $$
  select o.number from public.phone_opt_outs o
  where private.can_text_line(p_line) and o.number = any (p_numbers[1:200]);
$$;
revoke execute on function public.line_opt_outs(uuid, text[]) from public, anon;
grant execute on function public.line_opt_outs(uuid, text[]) to authenticated;

-- 2. Emails from a workspace --------------------------------------------
create table if not exists public.workspace_emails (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  to_email text not null check (char_length(to_email) between 3 and 320),
  subject text not null check (char_length(subject) between 1 and 300),
  body text not null check (char_length(body) <= 50000),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  provider_id text check (char_length(provider_id) <= 200),
  error text check (char_length(error) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists workspace_emails_recent on public.workspace_emails (workspace_id, created_at desc);
create index if not exists workspace_emails_sender_day on public.workspace_emails (sent_by, created_at desc);
alter table public.workspace_emails enable row level security;
grant select on public.workspace_emails to authenticated;
grant insert (workspace_id, contact_id, to_email, subject, body, status, provider_id, error) on public.workspace_emails to authenticated;
create policy workspace_emails_select on public.workspace_emails for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy workspace_emails_insert on public.workspace_emails for insert to authenticated
  with check ((select private.is_member(workspace_id)) and sent_by = (select auth.uid()));

create table if not exists public.workspace_email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 50000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_email_templates_ws on public.workspace_email_templates (workspace_id, name);
alter table public.workspace_email_templates enable row level security;
grant select, delete on public.workspace_email_templates to authenticated;
grant insert (workspace_id, name, subject, body) on public.workspace_email_templates to authenticated;
grant update (name, subject, body, updated_at) on public.workspace_email_templates to authenticated;
create policy workspace_email_templates_select on public.workspace_email_templates for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy workspace_email_templates_insert on public.workspace_email_templates for insert to authenticated
  with check ((select private.is_member(workspace_id)));
create policy workspace_email_templates_update on public.workspace_email_templates for update to authenticated
  using ((select private.is_member(workspace_id))) with check ((select private.is_member(workspace_id)));
create policy workspace_email_templates_delete on public.workspace_email_templates for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));
