-- Email delivery tracking from Resend's event webhooks: delivered, opened,
-- clicked, bounced, complained, delayed, failed, suppressed. Events are
-- written only by the signed webhook (service role, through
-- email_track_event); staff with comms.view can read them.

alter table public.email_sends
  add column delivered_at timestamptz,
  add column opened_at timestamptz,
  add column clicked_at timestamptz,
  add column bounced_at timestamptz,
  add column complained_at timestamptz,
  add column open_count integer not null default 0 check (open_count >= 0),
  add column click_count integer not null default 0 check (click_count >= 0),
  add column last_event text check (char_length(last_event) <= 30);
create index email_sends_provider_idx on public.email_sends (provider_id) where provider_id is not null;

-- Every event, once (svix_id is the webhook delivery id, so retries don't double-count).
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique check (char_length(svix_id) <= 200),
  send_id uuid references public.email_sends (id) on delete cascade,
  provider_id text not null check (char_length(provider_id) <= 200),
  type text not null check (type in ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'delayed', 'failed', 'suppressed')),
  url text check (char_length(url) <= 2000),
  detail text check (char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);
create index email_events_send_idx on public.email_events (send_id, created_at desc);
create index email_events_provider_idx on public.email_events (provider_id);

revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;
alter table public.email_events enable row level security;
create policy "email_events_select" on public.email_events for select to authenticated using ((select private.staff_can('comms.view')));

-- Why an address is off the list. Hard bounces and spam complaints are added
-- automatically so nobody keeps emailing a dead or unwilling address.
alter table public.email_unsubscribes
  add column reason text not null default 'unsubscribed' check (reason in ('unsubscribed', 'bounced', 'complained'));

-- Per bulk send: how many were delivered, opened, clicked, bounced, complained.
create view public.email_campaign_stats with (security_invoker = true) as
  select campaign_id,
         count(*) filter (where delivered_at is not null) as delivered,
         count(*) filter (where opened_at is not null) as opened,
         count(*) filter (where clicked_at is not null) as clicked,
         count(*) filter (where bounced_at is not null) as bounced,
         count(*) filter (where complained_at is not null) as complained
  from public.email_sends
  where campaign_id is not null
  group by campaign_id;
revoke all on public.email_campaign_stats from anon, authenticated;
grant select on public.email_campaign_stats to authenticated;

-- Record one webhook event. Service role only (the webhook verifies the
-- Svix signature first). Returns false when the event was already recorded.
create function public.email_track_event(
  p_svix_id text, p_provider_id text, p_type text, p_at timestamptz, p_to text default null,
  p_url text default null, p_detail text default null, p_hard_bounce boolean default false
) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_send uuid;
  v_to text;
begin
  select id, to_email into v_send, v_to from public.email_sends where provider_id = p_provider_id order by created_at desc limit 1;
  insert into public.email_events (svix_id, send_id, provider_id, type, url, detail, created_at)
  values (p_svix_id, v_send, p_provider_id, p_type, left(p_url, 2000), left(p_detail, 1000), coalesce(p_at, now()))
  on conflict (svix_id) do nothing;
  if not found then return false; end if;

  if v_send is not null then
    update public.email_sends set
      delivered_at = case when p_type = 'delivered' then coalesce(delivered_at, p_at) else delivered_at end,
      opened_at = case when p_type = 'opened' then coalesce(opened_at, p_at) else opened_at end,
      clicked_at = case when p_type = 'clicked' then coalesce(clicked_at, p_at) else clicked_at end,
      bounced_at = case when p_type = 'bounced' then coalesce(bounced_at, p_at) else bounced_at end,
      complained_at = case when p_type = 'complained' then coalesce(complained_at, p_at) else complained_at end,
      open_count = open_count + (p_type = 'opened')::int,
      click_count = click_count + (p_type = 'clicked')::int,
      last_event = p_type
    where id = v_send;
  end if;

  v_to := lower(coalesce(v_to, p_to));
  if v_to is not null and (p_type = 'complained' or (p_type = 'bounced' and p_hard_bounce)) then
    insert into public.email_unsubscribes (email, reason) values (v_to, p_type) on conflict (email) do nothing;
  end if;
  return true;
end $$;
revoke all on function public.email_track_event(text, text, text, timestamptz, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.email_track_event(text, text, text, timestamptz, text, text, text, boolean) to service_role;
