-- Redial mobile app: phones registered for push notifications (Expo push
-- tokens, delivered through APNs and FCM), and how much a notification shows.

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null unique check (char_length(token) between 10 and 300),
  platform text not null check (platform in ('android', 'ios')),
  app_version text check (char_length(app_version) <= 40),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_id_idx on public.device_tokens (user_id);

revoke all on public.device_tokens from anon, authenticated;
grant select (id, platform, app_version, created_at, last_seen_at), delete on public.device_tokens to authenticated;
alter table public.device_tokens enable row level security;
create policy "device_tokens_select_own" on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy "device_tokens_delete_own" on public.device_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- Registers this phone for the signed-in member. A phone that was signed in
-- as someone else moves to the new account, so the old one stops getting its
-- notifications.
create function public.register_device(p_token text, p_platform text, p_app_version text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_active_user() then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,250}\]$' then
    raise exception 'That isn''t a push token.';
  end if;
  if p_platform not in ('android', 'ios') then raise exception 'Unknown platform.'; end if;
  insert into public.device_tokens (user_id, token, platform, app_version)
  values ((select auth.uid()), p_token, p_platform, left(p_app_version, 40))
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, app_version = excluded.app_version, last_seen_at = now();
end $$;
revoke execute on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;

-- What a push notification shows: everything (default), the caller only, or
-- nothing about the call.
alter table public.profiles add column push_privacy text not null default 'full'
  check (push_privacy in ('full', 'caller', 'private'));
grant select (push_privacy), update (push_privacy) on public.profiles to authenticated;
