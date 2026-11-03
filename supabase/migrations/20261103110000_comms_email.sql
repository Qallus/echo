-- Super Admin v2, batch A3 step 1: Communications. Email templates (block
-- builder), the send log, unsubscribes, and the inbox (inbound email and the
-- website contact form). Staff only: comms.view to read, comms.manage to write.

-- ---------------------------------------------------------------------------
-- Permissions: comms.view / comms.manage (owner, admin, support, marketing),
-- social.manage (owner, admin, marketing), projects.manage (owner, admin, support).
-- ---------------------------------------------------------------------------
create or replace function private.role_permissions(r public.staff_role) returns text[]
language sql immutable set search_path = '' as $$
  select case r
    when 'owner' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'staff.manage', 'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage']
    when 'admin' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'users.manage', 'workspaces.view', 'workspaces.manage',
      'billing.view', 'billing.manage', 'ai.view', 'ai.manage', 'notifications.view',
      'crm.view', 'crm.manage', 'content.manage', 'settings.manage', 'audit.view',
      'comms.view', 'comms.manage', 'social.manage', 'projects.manage']
    when 'support' then array[
      'dashboard.view', 'users.view', 'users.manage', 'workspaces.view', 'notifications.view', 'crm.view', 'crm.manage',
      'comms.view', 'comms.manage', 'projects.manage']
    when 'finance' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'billing.manage', 'crm.view']
    when 'marketing' then array[
      'dashboard.view', 'analytics.view', 'crm.view', 'crm.manage', 'content.manage',
      'comms.view', 'comms.manage', 'social.manage']
    when 'analyst' then array[
      'dashboard.view', 'analytics.view', 'users.view', 'workspaces.view', 'billing.view', 'ai.view']
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- Email templates and the send log
-- ---------------------------------------------------------------------------
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 300),
  preheader text check (char_length(preheader) <= 300),
  category text not null default 'general' check (char_length(category) <= 40),
  schema jsonb check (schema is null or pg_column_size(schema) <= 262144),
  html text not null default '' check (char_length(html) <= 500000),
  body_text text not null default '' check (char_length(body_text) <= 100000),
  sends integer not null default 0,
  last_sent_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_templates_created_by_idx on public.email_templates (created_by);
create trigger email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.email_templates (id) on delete set null,
  to_email text not null check (char_length(to_email) <= 200),
  subject text not null check (char_length(subject) <= 300),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text check (char_length(provider_id) <= 200),
  error text check (char_length(error) <= 1000),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  deal_id uuid references public.crm_deals (id) on delete set null,
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_sends_created_idx on public.email_sends (created_at desc);
create index email_sends_template_idx on public.email_sends (template_id);
create index email_sends_contact_idx on public.email_sends (contact_id);
create index email_sends_deal_idx on public.email_sends (deal_id);
create index email_sends_sent_by_idx on public.email_sends (sent_by);

-- People who clicked Unsubscribe. Template sends skip them.
create table public.email_unsubscribes (
  email text primary key check (email = lower(email) and char_length(email) <= 200),
  created_at timestamptz not null default now()
);

revoke all on public.email_templates, public.email_sends, public.email_unsubscribes from anon, authenticated;
grant select, delete on public.email_templates to authenticated;
grant insert (name, subject, preheader, category, schema, html, body_text),
      update (name, subject, preheader, category, schema, html, body_text, sends, last_sent_at)
  on public.email_templates to authenticated;
grant select on public.email_sends to authenticated;
grant insert (template_id, to_email, subject, status, provider_id, error, contact_id, deal_id) on public.email_sends to authenticated;
grant select, delete on public.email_unsubscribes to authenticated;

alter table public.email_templates enable row level security;
alter table public.email_sends enable row level security;
alter table public.email_unsubscribes enable row level security;

create policy "email_templates_select" on public.email_templates for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_templates_insert" on public.email_templates for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "email_templates_update" on public.email_templates for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "email_templates_delete" on public.email_templates for delete to authenticated using ((select private.staff_can('comms.manage')));
create policy "email_sends_select" on public.email_sends for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_sends_insert" on public.email_sends for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "email_unsubscribes_select" on public.email_unsubscribes for select to authenticated using ((select private.staff_can('comms.view')));
create policy "email_unsubscribes_delete" on public.email_unsubscribes for delete to authenticated using ((select private.staff_can('comms.manage')));
-- Unsubscribes are written by /unsubscribe after it verifies the signed link.

-- Emails sent from Echo land on the CRM timeline with their addresses.
grant insert (from_addr, to_addr, status) on public.crm_activities to authenticated;

-- ---------------------------------------------------------------------------
-- Inbox: inbound email and website contact form submissions
-- ---------------------------------------------------------------------------
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'form')),
  from_name text check (char_length(from_name) <= 200),
  from_email text check (char_length(from_email) <= 200),
  phone text check (char_length(phone) <= 40),
  company text check (char_length(company) <= 200),
  to_email text check (char_length(to_email) <= 200),
  subject text check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 100000),
  topic text check (char_length(topic) <= 60),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  provider_id text unique check (char_length(provider_id) <= 200),
  meta jsonb not null default '{}'::jsonb check (pg_column_size(meta) <= 16384),
  created_at timestamptz not null default now()
);
create index inbox_messages_created_idx on public.inbox_messages (created_at desc);
create index inbox_messages_status_idx on public.inbox_messages (status);
create index inbox_messages_contact_idx on public.inbox_messages (contact_id);
create index inbox_messages_from_idx on public.inbox_messages (lower(from_email), created_at desc);

revoke all on public.inbox_messages from anon, authenticated;
grant select, delete on public.inbox_messages to authenticated;
grant update (status, contact_id) on public.inbox_messages to authenticated;
alter table public.inbox_messages enable row level security;
create policy "inbox_select" on public.inbox_messages for select to authenticated using ((select private.staff_can('comms.view')));
create policy "inbox_update" on public.inbox_messages for update to authenticated
  using ((select private.staff_can('comms.manage'))) with check ((select private.staff_can('comms.manage')));
create policy "inbox_delete" on public.inbox_messages for delete to authenticated using ((select private.staff_can('comms.manage')));
-- Inbound email is written by the signed Resend webhook; forms by the function below.

-- The public contact form (anyone, signed in or not). At most 5 messages per
-- email address per hour.
create function public.submit_contact_form(p_name text, p_email text, p_phone text, p_company text, p_topic text, p_message text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 200);
  v_body text := left(trim(coalesce(p_message, '')), 10000);
begin
  if v_name = '' or v_body = '' then raise exception 'Name and message are required' using errcode = '22023'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
  if (select count(*) from public.inbox_messages where lower(from_email) = v_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many messages. Try again later.' using errcode = '54000';
  end if;
  insert into public.inbox_messages (channel, from_name, from_email, phone, company, topic, subject, body)
  values ('form', v_name, v_email, left(nullif(trim(p_phone), ''), 40), left(nullif(trim(p_company), ''), 200),
          left(nullif(trim(p_topic), ''), 60), left('Website: ' || coalesce(nullif(trim(p_topic), ''), 'Contact'), 300), v_body);
end $$;
revoke execute on function public.submit_contact_form(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_form(text, text, text, text, text, text) to anon, authenticated;

-- Every new inbox message notifies staff who can read the inbox.
create function private.inbox_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  for s in select user_id, role from public.platform_staff loop
    if 'comms.view' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'inbox_message',
        'New ' || case new.channel when 'form' then 'website message' else 'email' end || ' from ' || coalesce(new.from_name, new.from_email, 'someone'),
        left(coalesce(nullif(new.subject, ''), new.body), 200), '/admin/communications?tab=inbox', jsonb_build_object('message_id', new.id));
    end if;
  end loop;
  return null;
end $$;
revoke execute on function private.inbox_notify() from public, anon, authenticated;
create trigger inbox_messages_notify after insert on public.inbox_messages for each row execute function private.inbox_notify();

-- The Notifications tab: staff with notifications.view read notification titles
-- and types alongside the delivery log (the bodies are short summaries).
create policy "notifications_select_staff" on public.notifications for select to authenticated
  using ((select private.staff_can('notifications.view')));
