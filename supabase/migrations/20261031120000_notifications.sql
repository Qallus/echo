-- Echo: notifications. In-app bell (with Realtime), plus email, SMS and push
-- delivered by /api/notifications/deliver, which the database calls (pg_net)
-- for every new notification.
--
-- Secrets live in Supabase Vault, never in this file. Set them once:
--   select vault.create_secret('<NOTIFY_SECRET>', 'notify_secret');
--   select vault.create_secret('https://echo.redial.si/api/notifications/deliver', 'notify_deliver_url');
-- NOTIFY_SECRET must match the app's env var. It signs the delivery call and
-- hashes verification codes, so a code can only be checked by the database.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Notifications (the bell)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 50),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 1000),
  url text check (char_length(url) <= 500),
  data jsonb not null default '{}'::jsonb,
  show_in_app boolean not null default true,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_recent on public.notifications (user_id, created_at desc);
create index notifications_user_unread on public.notifications (user_id) where read_at is null and show_in_app;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications_mark_read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Preferences: one row per event type; a missing row means the defaults
-- (in-app and email on, SMS and push off).
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 50),
  in_app boolean not null default true,
  email boolean not null default true,
  sms boolean not null default false,
  push boolean not null default false,
  primary key (user_id, type)
);
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "notification_preferences_own" on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Quiet hours (SMS and push wait; email and the bell still arrive).
alter table public.profiles
  add column quiet_start time,
  add column quiet_end time;
grant select (quiet_start, quiet_end) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Channels: extra email addresses, phone numbers (both verified by code) and
-- push subscriptions (one per browser/device).
-- ---------------------------------------------------------------------------
create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('email', 'sms', 'push')),
  address text not null check (char_length(address) <= 1000),
  label text check (char_length(label) <= 100),
  push_subscription jsonb,
  verified_at timestamptz,
  code_hash text,
  code_expires_at timestamptz,
  code_attempts int not null default 0,
  code_sends int not null default 0,
  code_window_start timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, address)
);
create index notification_channels_user on public.notification_channels (user_id);

-- Users read and add their channels; verification fields are off limits.
grant select (id, user_id, kind, address, label, verified_at, code_expires_at, created_at)
  on public.notification_channels to authenticated;
grant insert (user_id, kind, address, label, push_subscription) on public.notification_channels to authenticated;
grant update (label) on public.notification_channels to authenticated;
grant delete on public.notification_channels to authenticated;
grant all on public.notification_channels to service_role;
alter table public.notification_channels enable row level security;
create policy "notification_channels_own" on public.notification_channels for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A browser's push subscription is proof enough; email and SMS start unverified.
create function private.channel_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.verified_at := case when new.kind = 'push' then now() else null end;
  return new;
end $$;
create trigger notification_channels_defaults before insert on public.notification_channels
  for each row execute function private.channel_defaults();

create function private.notify_secret() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret' limit 1;
$$;
revoke execute on function private.notify_secret() from public, anon, authenticated;

-- Store a code hash for one of your channels (the server action computes
-- hmac(code) with NOTIFY_SECRET, then texts or emails the code). At most 3
-- codes per channel per hour.
create function public.channel_code_issue(channel uuid, hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  c public.notification_channels;
begin
  select * into c from public.notification_channels
  where id = channel and user_id = (select auth.uid()) and kind in ('email', 'sms') for update;
  if not found then raise exception 'Channel not found'; end if;
  if c.code_window_start is not null and c.code_window_start > now() - interval '1 hour' and c.code_sends >= 3 then
    return false;
  end if;
  update public.notification_channels set
    code_hash = hash,
    code_expires_at = now() + interval '15 minutes',
    code_attempts = 0,
    code_sends = case when code_window_start is null or code_window_start <= now() - interval '1 hour' then 1 else code_sends + 1 end,
    code_window_start = case when code_window_start is null or code_window_start <= now() - interval '1 hour' then now() else code_window_start end
  where id = channel;
  return true;
end $$;
revoke execute on function public.channel_code_issue(uuid, text) from public, anon;
grant execute on function public.channel_code_issue(uuid, text) to authenticated;

-- Check a code. The database computes the hash itself with the secret, so a
-- hash someone stored by calling channel_code_issue directly never matches.
create function public.channel_code_verify(channel uuid, code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.notification_channels;
begin
  select * into c from public.notification_channels
  where id = channel and user_id = (select auth.uid()) for update;
  if not found then return 'not_found'; end if;
  if c.verified_at is not null then return 'verified'; end if;
  if c.code_hash is null or c.code_expires_at < now() then return 'expired'; end if;
  if c.code_attempts >= 5 then return 'locked'; end if;
  if encode(extensions.hmac(channel::text || ':' || trim(code), private.notify_secret(), 'sha256'), 'hex') = c.code_hash then
    update public.notification_channels set verified_at = now(), code_hash = null, code_expires_at = null where id = channel;
    return 'verified';
  end if;
  update public.notification_channels set code_attempts = code_attempts + 1 where id = channel;
  return 'wrong';
end $$;
revoke execute on function public.channel_code_verify(uuid, text) from public, anon;
grant execute on function public.channel_code_verify(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery log (written by the delivery route; read in Super Admin later).
-- ---------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'push')),
  target text,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  detail text,
  provider_id text,
  created_at timestamptz not null default now()
);
create index notification_deliveries_notification on public.notification_deliveries (notification_id);
grant all on public.notification_deliveries to service_role;
alter table public.notification_deliveries enable row level security;
create policy "notification_deliveries_super_admin" on public.notification_deliveries for select to authenticated
  using (private.is_super_admin());
grant select on public.notification_deliveries to authenticated;

-- ---------------------------------------------------------------------------
-- Creating notifications: only through private.notify (triggers, functions).
-- ---------------------------------------------------------------------------
create function private.notify(recipient uuid, kind text, title text, body text, link text, payload jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  show boolean;
begin
  select coalesce((select in_app from public.notification_preferences where user_id = recipient and type = kind), true) into show;
  insert into public.notifications (user_id, type, title, body, url, data, show_in_app)
  values (recipient, kind, left(title, 200), left(body, 1000), link, payload, show);
end $$;
revoke execute on function private.notify(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- Hand each new notification to the delivery route (email, SMS, push).
create function private.deliver_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_deliver_url' limit 1);
  secret text := private.notify_secret();
begin
  if url is null or secret is null then return null; end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Echo-Secret', secret),
    timeout_milliseconds := 10000
  );
  return null;
end $$;
create trigger notifications_deliver after insert on public.notifications
  for each row execute function private.deliver_notification();

-- Transcription finished (or failed): tell whoever created the recording.
create function private.notify_recording_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is null or old.status <> 'processing' or new.status = 'processing' then return null; end if;
  if new.status = 'failed' then
    perform private.notify(new.created_by, 'transcript_failed', 'Transcription failed: ' || new.title,
      coalesce(new.processing_error, 'Open the recording to try again.'), '/recordings/' || new.id, jsonb_build_object('recording_id', new.id));
  else
    perform private.notify(new.created_by, 'transcript_ready', 'Transcript ready: ' || new.title,
      'Your recording has been transcribed.', '/recordings/' || new.id, jsonb_build_object('recording_id', new.id));
  end if;
  return null;
end $$;
create trigger recordings_notify_status after update of status on public.recordings
  for each row execute function private.notify_recording_status();

-- A summary added later (e.g. written by Claude): tell the creator. Summaries
-- made during transcription are covered by transcript_ready.
create function private.notify_summary() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.recordings;
begin
  select * into r from public.recordings where id = new.recording_id;
  if r.created_by is null or r.status = 'processing' then return null; end if;
  perform private.notify(r.created_by, 'summary_ready', 'Summary ready: ' || r.title,
    left(new.overview, 300), '/recordings/' || r.id, jsonb_build_object('recording_id', r.id));
  return null;
end $$;
create trigger summaries_notify after insert on public.summaries
  for each row execute function private.notify_summary();

-- Someone joined a Business workspace: tell its owners and admins.
create function private.notify_member_joined() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws public.workspaces;
  who text;
  admin_id uuid;
begin
  select * into ws from public.workspaces where id = new.workspace_id;
  if ws.is_personal or new.role = 'owner' then return null; end if;
  select coalesce(nullif(p.full_name, ''), u.email) into who
  from auth.users u left join public.profiles p on p.id = u.id where u.id = new.user_id;
  for admin_id in
    select user_id from public.workspace_members
    where workspace_id = new.workspace_id and role in ('owner', 'admin') and user_id <> new.user_id
  loop
    perform private.notify(admin_id, 'member_joined', who || ' joined ' || ws.name,
      'They can now hear the recordings shared in ' || ws.name || '.', '/team', jsonb_build_object('workspace_id', ws.id, 'user_id', new.user_id));
  end loop;
  return null;
end $$;
create trigger workspace_members_notify after insert on public.workspace_members
  for each row execute function private.notify_member_joined();

-- "Send a test" from notification settings (to yourself only, max 5 per hour).
create function public.send_test_notification() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.notifications
      where user_id = (select auth.uid()) and type = 'test' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Test limit reached. Try again in an hour.';
  end if;
  perform private.notify((select auth.uid()), 'test', 'Test notification',
    'Notifications from Echo will arrive like this.', '/settings/notifications');
end $$;
revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
