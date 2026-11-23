-- Social posting (Admin -> Social): Redial's own LinkedIn, Facebook Page and
-- Instagram accounts, and posts drafted, scheduled and published to them.
-- * social_accounts: one row per account or page Redial can post as. Tokens
--   are encrypted by the server (src/lib/ai/keys.ts) before they're stored
--   and are only used on the server.
-- * social_posts: the text, an optional image and link, the accounts it goes
--   to, and per-account results. The scheduled job publishes due posts.
-- Everything needs social.manage (owner, admin, marketing; agents only when
-- given it). Publishing right away from the connector needs a person's yes.

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('linkedin', 'facebook', 'instagram')),
  kind text not null default 'page' check (kind in ('person', 'page')),
  external_id text not null check (char_length(external_id) between 1 and 200),
  name text not null check (char_length(name) between 1 and 200),
  picture text check (char_length(picture) <= 1000),
  access_token text check (char_length(access_token) <= 8000),
  refresh_token text check (char_length(refresh_token) <= 8000),
  expires_at timestamptz,
  scopes text[] not null default '{}' check (cardinality(scopes) <= 40),
  status text not null default 'active' check (status in ('active', 'expired', 'error', 'disconnected')),
  last_error text check (char_length(last_error) <= 500),
  connected_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index social_accounts_connected_by_idx on public.social_accounts (connected_by);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  body text not null default '' check (char_length(body) <= 5000),
  image_url text check (char_length(image_url) <= 1000),
  link_url text check (char_length(link_url) <= 1000),
  account_ids uuid[] not null default '{}' check (cardinality(account_ids) <= 20),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'partly_published', 'failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  results jsonb not null default '[]' check (jsonb_typeof(results) = 'array'),
  error text check (char_length(error) <= 1000),
  campaign text check (char_length(campaign) <= 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_due_idx on public.social_posts (scheduled_at) where status = 'scheduled';
create index social_posts_created_by_idx on public.social_posts (created_by);

revoke all on public.social_accounts, public.social_posts from anon, authenticated;
grant select, delete on public.social_accounts, public.social_posts to authenticated;
grant insert (provider, kind, external_id, name, picture, access_token, refresh_token, expires_at, scopes, status, last_error),
      update (name, picture, access_token, refresh_token, expires_at, scopes, status, last_error, updated_at)
  on public.social_accounts to authenticated;
grant insert (body, image_url, link_url, account_ids, status, scheduled_at, campaign),
      update (body, image_url, link_url, account_ids, status, scheduled_at, published_at, results, error, campaign, updated_at)
  on public.social_posts to authenticated;
alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;

create policy "social_accounts_all" on public.social_accounts for all to authenticated
  using ((select private.staff_can('social.manage'))) with check ((select private.staff_can('social.manage')));
create policy "social_posts_all" on public.social_posts for all to authenticated
  using ((select private.staff_can('social.manage'))) with check ((select private.staff_can('social.manage')));

notify pgrst, 'reload schema';
