-- Analytics (docs/ANALYTICS_PLAN.md): where visitors come from and what they
-- do, Google Search, AI assistants, campaigns, social, ad spend, the Redial
-- product funnel. Staff read it in Admin -> Analytics (analytics.view).
--
-- Privacy: no cookies. A visit is counted with an anonymous hash that changes
-- every day; IP addresses are never stored.
--
--   site_events          page views and conversions on redial.si
--   crawler_hits         AI and search crawlers reading the site
--   ai_visibility_runs   monthly "does AI recommend Redial?" checks
--   ai_visibility_checks   one answer per assistant per question
--   search_console_rows  Google Search Console, by day, search term and page
--   short_links          redial.si/l/<code> links (texts) and their clicks
--   marketing_spend      ad and campaign spend by month (for cost per signup)
--   social_stats         followers, reach and clicks by network and month
--
-- Public writes go through security definer functions that check their
-- input (track_site_event, track_crawler, short_link_open); everything else
-- is staff-only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('view', 'conversion')),
  name text check (name ~ '^[a-z_]{1,40}$'),
  path text not null check (char_length(path) between 1 and 300),
  referrer_host text check (char_length(referrer_host) <= 200),
  channel text not null check (channel in ('search', 'ai', 'social', 'email', 'sms', 'ads', 'referral', 'direct', 'campaign', 'card', 'partner')),
  source text check (char_length(source) <= 100),
  medium text check (char_length(medium) <= 60),
  campaign text check (char_length(campaign) <= 120),
  landing text check (char_length(landing) <= 300),
  visitor text not null check (visitor ~ '^[a-f0-9]{16}$'),
  session text not null check (session ~ '^[A-Za-z0-9_-]{8,40}$'),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  country text check (country ~ '^[A-Z]{2}$'),
  user_id uuid references auth.users (id) on delete set null
);
create index site_events_created_idx on public.site_events (created_at);
create index site_events_session_idx on public.site_events (session);
create index site_events_user_idx on public.site_events (user_id);

create table public.crawler_hits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  bot text not null check (char_length(bot) <= 40),
  path text not null check (char_length(path) <= 300)
);
create index crawler_hits_created_idx on public.crawler_hits (created_at);

create table public.ai_visibility_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  questions text[] not null check (cardinality(questions) between 1 and 30),
  models text[] not null check (cardinality(models) between 1 and 10),
  status text not null default 'running' check (status in ('running', 'done')),
  finished_at timestamptz
);
create index ai_visibility_runs_created_by_idx on public.ai_visibility_runs (created_by);

create table public.ai_visibility_checks (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.ai_visibility_runs (id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null check (char_length(model) <= 40),
  question text not null check (char_length(question) <= 300),
  mentioned boolean not null default false,
  rank smallint check (rank between 1 and 50),
  competitors text[] not null default '{}' check (cardinality(competitors) <= 50),
  cited_urls text[] not null default '{}' check (cardinality(cited_urls) <= 30),
  answer text check (char_length(answer) <= 6000),
  error text check (char_length(error) <= 300),
  unique (run_id, model, question)
);

create table public.search_console_rows (
  day date not null,
  query text not null check (char_length(query) <= 300),
  page text not null check (char_length(page) <= 500),
  clicks integer not null default 0,
  impressions integer not null default 0,
  position numeric(6, 2),
  primary key (day, query, page)
);
create index search_console_rows_day_idx on public.search_console_rows (day);

create table public.short_links (
  code text primary key check (code ~ '^[A-Za-z0-9]{4,12}$'),
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  channel text not null default 'sms' check (channel in ('sms', 'email', 'social', 'card', 'partner', 'ads', 'campaign')),
  campaign text check (char_length(campaign) <= 120),
  clicks integer not null default 0,
  last_click_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index short_links_created_by_idx on public.short_links (created_by);

create table public.marketing_spend (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  channel text not null check (channel in ('search', 'ai', 'social', 'email', 'sms', 'ads', 'referral', 'campaign', 'card', 'partner')),
  source text check (char_length(source) <= 100),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  clicks integer check (clicks >= 0),
  impressions integer check (impressions >= 0),
  conversions integer check (conversions >= 0),
  notes text check (char_length(notes) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index marketing_spend_month_idx on public.marketing_spend (month);
create index marketing_spend_created_by_idx on public.marketing_spend (created_by);

create table public.social_stats (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  network text not null check (network in ('linkedin', 'facebook', 'instagram', 'x', 'youtube', 'tiktok', 'nextdoor', 'google_business', 'other')),
  followers integer check (followers >= 0),
  reach integer check (reach >= 0),
  engagements integer check (engagements >= 0),
  posts integer check (posts >= 0),
  clicks integer check (clicks >= 0),
  calls integer check (calls >= 0),
  notes text check (char_length(notes) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (month, network)
);
create index social_stats_created_by_idx on public.social_stats (created_by);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
revoke all on public.site_events, public.crawler_hits, public.ai_visibility_runs, public.ai_visibility_checks, public.search_console_rows,
  public.short_links, public.marketing_spend, public.social_stats from anon, authenticated;
grant select on public.site_events, public.crawler_hits, public.ai_visibility_runs, public.ai_visibility_checks, public.search_console_rows,
  public.short_links, public.marketing_spend, public.social_stats to authenticated;
grant insert on public.ai_visibility_runs, public.ai_visibility_checks to authenticated;
grant update (status, finished_at) on public.ai_visibility_runs to authenticated;
grant insert, update, delete on public.search_console_rows to authenticated;
grant insert (code, url, channel, campaign) on public.short_links to authenticated;
grant insert, update, delete on public.marketing_spend, public.social_stats to authenticated;

alter table public.site_events enable row level security;
alter table public.crawler_hits enable row level security;
alter table public.ai_visibility_runs enable row level security;
alter table public.ai_visibility_checks enable row level security;
alter table public.search_console_rows enable row level security;
alter table public.short_links enable row level security;
alter table public.marketing_spend enable row level security;
alter table public.social_stats enable row level security;

create policy "site_events_select" on public.site_events for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "crawler_hits_select" on public.crawler_hits for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "ai_visibility_runs_select" on public.ai_visibility_runs for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "ai_visibility_runs_insert" on public.ai_visibility_runs for insert to authenticated with check ((select private.staff_can('settings.manage')));
create policy "ai_visibility_runs_update" on public.ai_visibility_runs for update to authenticated
  using ((select private.staff_can('settings.manage'))) with check ((select private.staff_can('settings.manage')));
create policy "ai_visibility_checks_select" on public.ai_visibility_checks for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "ai_visibility_checks_insert" on public.ai_visibility_checks for insert to authenticated with check ((select private.staff_can('settings.manage')));
create policy "search_console_rows_select" on public.search_console_rows for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "search_console_rows_write" on public.search_console_rows for all to authenticated
  using ((select private.staff_can('settings.manage'))) with check ((select private.staff_can('settings.manage')));
create policy "short_links_select" on public.short_links for select to authenticated using ((select private.staff_can('comms.view')) or (select private.staff_can('analytics.view')));
create policy "short_links_insert" on public.short_links for insert to authenticated with check ((select private.staff_can('comms.manage')));
create policy "marketing_spend_select" on public.marketing_spend for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "marketing_spend_write" on public.marketing_spend for all to authenticated
  using ((select private.staff_can('settings.manage'))) with check ((select private.staff_can('settings.manage')));
create policy "social_stats_select" on public.social_stats for select to authenticated using ((select private.staff_can('analytics.view')));
create policy "social_stats_write" on public.social_stats for all to authenticated
  using ((select private.staff_can('settings.manage'))) with check ((select private.staff_can('settings.manage')));

-- AI visibility questions and competitors, and the weekly digest's state.
create policy "settings_insert_analytics" on public.platform_settings for insert to authenticated
  with check (key in ('ai_visibility', 'analytics_digest') and private.staff_can('settings.manage'));
create policy "settings_update_analytics" on public.platform_settings for update to authenticated
  using (key in ('ai_visibility', 'analytics_digest') and private.staff_can('settings.manage'))
  with check (key in ('ai_visibility', 'analytics_digest') and private.staff_can('settings.manage'));

-- ---------------------------------------------------------------------------
-- Public writes (no sign-in): page views and conversions, crawler visits,
-- short link clicks. Each checks its input; the server route that calls
-- track_site_event computes the anonymous visitor hash.
-- ---------------------------------------------------------------------------
create function public.track_site_event(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ch text := coalesce(p->>'channel', 'direct');
  k text := p->>'kind';
begin
  if k not in ('view', 'conversion') then return; end if;
  if ch not in ('search', 'ai', 'social', 'email', 'sms', 'ads', 'referral', 'direct', 'campaign', 'card', 'partner') then ch := 'direct'; end if;
  insert into public.site_events (kind, name, path, referrer_host, channel, source, medium, campaign, landing, visitor, session, device, country, user_id)
  values (
    k, case when k = 'conversion' and p->>'name' ~ '^[a-z_]{1,40}$' then p->>'name' end,
    left(coalesce(nullif(p->>'path', ''), '/'), 300), left(nullif(p->>'referrer_host', ''), 200), ch,
    left(nullif(p->>'source', ''), 100), left(nullif(p->>'medium', ''), 60), left(nullif(p->>'campaign', ''), 120), left(nullif(p->>'landing', ''), 300),
    p->>'visitor', p->>'session',
    case when p->>'device' in ('mobile', 'tablet', 'desktop') then p->>'device' end,
    case when p->>'country' ~ '^[A-Z]{2}$' then p->>'country' end,
    case when (p->>'user_id') ~ '^[0-9a-f-]{36}$' then (p->>'user_id')::uuid end
  );
exception when check_violation or invalid_text_representation or foreign_key_violation then
  return; -- bad input is dropped, not an error for the visitor
end $$;
revoke execute on function public.track_site_event(jsonb) from public;
grant execute on function public.track_site_event(jsonb) to anon, authenticated;

create function public.track_crawler(p_bot text, p_path text) returns void
language sql security definer set search_path = '' as $$
  insert into public.crawler_hits (bot, path) select left(p_bot, 40), left(coalesce(nullif(p_path, ''), '/'), 300) where coalesce(p_bot, '') <> '';
$$;
revoke execute on function public.track_crawler(text, text) from public;
grant execute on function public.track_crawler(text, text) to anon, authenticated;

create function public.short_link_open(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare target text;
begin
  update public.short_links set clicks = clicks + 1, last_click_at = now() where code = p_code returning url into target;
  return target;
end $$;
revoke execute on function public.short_link_open(text) from public;
grant execute on function public.short_link_open(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin -> Analytics in one call: totals, channels, campaigns, landing pages,
-- referrers, pages, devices, AI, crawlers, conversions, daily traffic, and
-- the Redial product funnel. Staff with analytics.view only.
-- A signup's channel comes from the attribution saved with the account.
-- ---------------------------------------------------------------------------
create function public.admin_analytics(p_since timestamptz, p_until timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare out jsonb;
begin
  if not private.staff_can('analytics.view') then raise exception 'Not allowed.' using errcode = '42501'; end if;

  with ev as (select * from public.site_events where created_at >= p_since and created_at < p_until),
  views as (select * from ev where kind = 'view'),
  sess as (
    select session, min(created_at) as first_at, max(visitor) as visitor,
      (array_agg(channel order by created_at))[1] as channel, (array_agg(source order by created_at))[1] as source,
      (array_agg(medium order by created_at))[1] as medium, (array_agg(campaign order by created_at))[1] as campaign,
      (array_agg(path order by created_at))[1] as landing, (array_agg(referrer_host order by created_at))[1] as ref,
      (array_agg(device order by created_at))[1] as device, count(*) as pages
    from views group by session
  ),
  conv as (select session, name, channel, source, campaign from ev where kind = 'conversion'),
  users as (
    select u.id, u.created_at,
      coalesce(nullif(u.raw_user_meta_data->'attribution'->>'channel', ''), 'unknown') as channel,
      u.raw_user_meta_data->'attribution'->>'campaign' as campaign
    from auth.users u where u.created_at >= p_since and u.created_at < p_until
  ),
  paid as (
    select o.user_id, o.total, coalesce(nullif(u.raw_user_meta_data->'attribution'->>'channel', ''), 'unknown') as channel
    from public.orders o join auth.users u on u.id = o.user_id
    where o.status in ('paid', 'partially_refunded') and o.created_at >= p_since and o.created_at < p_until
  ),
  spend as (
    select channel, sum(amount_cents) as cents from public.marketing_spend
    where month >= date_trunc('month', p_since)::date and month < p_until::date group by channel
  ),
  chans as (
    select c from (
      select channel as c from sess union select channel from users union select channel from paid union select channel from spend
    ) x
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from views),
      'sessions', (select count(*) from sess),
      'visitors', (select count(distinct visitor) from sess),
      'conversions', (select count(*) from conv),
      'signups', (select count(*) from users),
      'activated', (select count(*) from users x where exists (select 1 from public.redial_lines l where l.owner_id = x.id)
                      or exists (select 1 from public.redial_setups s where s.user_id = x.id and s.status in ('submitted', 'active'))),
      'paying', (select count(*) from users x where exists (select 1 from public.orders o where o.user_id = x.id and o.status in ('paid', 'partially_refunded'))),
      'revenue_cents', (select coalesce(sum(total), 0) from paid),
      'spend_cents', (select coalesce(sum(cents), 0) from spend),
      'bounce_sessions', (select count(*) from sess where pages = 1)
    ),
    'channels', (select coalesce(jsonb_agg(r order by r.sessions desc, r.signups desc), '[]'::jsonb) from (
      select ch.c as channel,
        (select count(*) from sess where sess.channel = ch.c) as sessions,
        (select count(distinct visitor) from sess where sess.channel = ch.c) as visitors,
        (select count(*) from conv where conv.channel = ch.c) as conversions,
        (select count(*) from users where users.channel = ch.c) as signups,
        (select coalesce(sum(total), 0) from paid where paid.channel = ch.c) as revenue_cents,
        (select coalesce(sum(cents), 0) from spend where spend.channel = ch.c) as spend_cents
      from chans ch) r),
    'campaigns', (select coalesce(jsonb_agg(r order by r.sessions desc), '[]'::jsonb) from (
      select s.source, s.medium, s.campaign, count(*) as sessions,
        (select count(*) from conv c where c.session in (select session from sess s2 where s2.source is not distinct from s.source and s2.medium is not distinct from s.medium and s2.campaign is not distinct from s.campaign)) as conversions,
        (select count(*) from users u where u.campaign = s.campaign) as signups
      from sess s where s.campaign is not null or s.medium is not null
      group by s.source, s.medium, s.campaign limit 50) r),
    'landing', (select coalesce(jsonb_agg(r order by r.sessions desc), '[]'::jsonb) from (
      select landing as path, count(*) as sessions, count(*) filter (where exists (select 1 from conv where conv.session = sess.session)) as converted
      from sess group by landing order by count(*) desc limit 30) r),
    'referrers', (select coalesce(jsonb_agg(r order by r.sessions desc), '[]'::jsonb) from (
      select ref as host, channel, count(*) as sessions from sess where ref is not null group by ref, channel order by count(*) desc limit 30) r),
    'pages', (select coalesce(jsonb_agg(r order by r.views desc), '[]'::jsonb) from (
      select path, count(*) as views, count(distinct session) as sessions from views group by path order by count(*) desc limit 30) r),
    'devices', (select coalesce(jsonb_object_agg(coalesce(device, 'unknown'), n), '{}'::jsonb) from (select device, count(*) as n from sess group by device) d),
    'conversions', (select coalesce(jsonb_agg(r order by r.count desc), '[]'::jsonb) from (select name, count(*) as count from conv group by name) r),
    'ai_sources', (select coalesce(jsonb_agg(r order by r.sessions desc), '[]'::jsonb) from (
      select coalesce(source, ref, 'unknown') as source, count(*) as sessions,
        count(*) filter (where exists (select 1 from conv where conv.session = sess.session)) as converted
      from sess where channel = 'ai' group by coalesce(source, ref, 'unknown')) r),
    'crawlers', (select coalesce(jsonb_agg(r order by r.hits desc), '[]'::jsonb) from (
      select bot, count(*) as hits, count(distinct path) as pages, max(created_at) as last_seen
      from public.crawler_hits where created_at >= p_since and created_at < p_until group by bot) r),
    'crawled_pages', (select coalesce(jsonb_agg(r order by r.hits desc), '[]'::jsonb) from (
      select path, count(*) as hits, array_agg(distinct bot) as bots
      from public.crawler_hits where created_at >= p_since and created_at < p_until group by path order by count(*) desc limit 20) r),
    'daily', (select coalesce(jsonb_agg(r order by r.day), '[]'::jsonb) from (
      select date_trunc('day', created_at)::date as day, count(*) filter (where kind = 'view') as views,
        count(distinct session) filter (where kind = 'view') as sessions, count(*) filter (where kind = 'conversion') as conversions
      from ev group by 1) r),
    'product', jsonb_build_object(
      'setup_steps', (select coalesce(jsonb_agg(r order by r.step), '[]'::jsonb) from (
        select step, count(*) filter (where status = 'draft') as in_progress, count(*) filter (where status <> 'draft') as finished
        from public.redial_setups group by step) r),
      'setup_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from public.redial_setups group by status) s),
      'lines', (select count(*) from public.redial_lines),
      'calls', (select count(*) from public.redial_calls where started_at >= p_since and started_at < p_until),
      'calls_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) as n from public.redial_calls where started_at >= p_since and started_at < p_until group by status) s),
      'likely_scams', (select count(*) from public.redial_calls where verdict = 'likely_scam' and started_at >= p_since and started_at < p_until),
      'spam', (select count(*) from public.redial_calls where category = 'spam' and started_at >= p_since and started_at < p_until),
      'family_alerts', (select count(*) from public.redial_protection_alerts where sent_at >= p_since and sent_at < p_until),
      'active_by_month', (select coalesce(jsonb_agg(r order by r.month), '[]'::jsonb) from (
        select date_trunc('month', started_at)::date as month, count(distinct owner_id) as users, count(*) as calls
        from public.redial_calls where started_at >= date_trunc('month', now()) - interval '5 months' group by 1) r),
      'subscriptions', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from public.subscriptions group by status) s)
    )
  ) into out;
  return out;
end $$;
revoke execute on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
