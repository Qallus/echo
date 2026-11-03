-- Echo Super Admin S3: customers' own AI keys, custom (local) providers and
-- AI usage tracking.
--
-- Keys are encrypted by the server (AES-256-GCM, AI_KEYS_SECRET held only in
-- Coolify) before they reach the database. The ciphertext column is never
-- granted to clients; the server reads it through resolve_ai_keys(), and even
-- then it's useless without the server secret.

-- ---------------------------------------------------------------------------
-- Whose keys a Business workspace uses: one set for the team, or each person's own
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column ai_key_scope text not null default 'workspace' check (ai_key_scope in ('workspace', 'member'));
grant select (ai_key_scope) on public.workspaces to authenticated; -- changed only through set_ai_key_scope

create function public.set_ai_key_scope(p_workspace uuid, p_scope text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_workspace, array['owner']::public.workspace_role[]) then
    raise exception 'Only the workspace owner can change this.' using errcode = '42501';
  end if;
  if p_scope not in ('workspace', 'member') then raise exception 'Invalid scope' using errcode = '22023'; end if;
  update public.workspaces set ai_key_scope = p_scope where id = p_workspace and not is_personal;
end $$;
revoke execute on function public.set_ai_key_scope(uuid, text) from public, anon;
grant execute on function public.set_ai_key_scope(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Customer keys: a Business workspace's keys, or a person's own keys (used in
-- their Personal workspace, and in Business workspaces set to "each person").
-- ---------------------------------------------------------------------------
create table public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('workspace', 'user')),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  provider text not null check (provider in ('claude', 'gpt', 'gemini', 'grok', 'kimi', 'openrouter')),
  ciphertext text not null check (char_length(ciphertext) <= 2000),
  last4 text not null check (char_length(last4) <= 8),
  model text check (char_length(model) <= 100),
  status text not null default 'ok' check (status in ('ok', 'failed')),
  last_error text check (char_length(last_error) <= 500),
  last_tested_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'workspace' and workspace_id is not null and user_id is null)
      or (scope = 'user' and user_id is not null and workspace_id is null))
);
create unique index ai_keys_workspace_provider on public.ai_keys (workspace_id, provider) where scope = 'workspace';
create unique index ai_keys_user_provider on public.ai_keys (user_id, provider) where scope = 'user';
create index ai_keys_created_by_idx on public.ai_keys (created_by);
create trigger ai_keys_updated_at before update on public.ai_keys for each row execute function public.set_updated_at();

revoke all on public.ai_keys from anon, authenticated;
grant select (id, scope, workspace_id, user_id, provider, last4, model, status, last_error, last_tested_at, created_at, updated_at)
  on public.ai_keys to authenticated;
grant insert (scope, workspace_id, user_id, provider, ciphertext, last4, model, status, last_error, last_tested_at)
  on public.ai_keys to authenticated;
grant update (ciphertext, last4, model, status, last_error, last_tested_at) on public.ai_keys to authenticated;
grant delete on public.ai_keys to authenticated;
alter table public.ai_keys enable row level security;

-- Members can see that a workspace key exists (provider, last 4, status);
-- only owners and admins add, change or remove it. Your own keys are yours.
create policy "ai_keys_select" on public.ai_keys for select to authenticated
  using ((scope = 'workspace' and private.is_member(workspace_id)) or (scope = 'user' and user_id = (select auth.uid())));
create policy "ai_keys_insert" on public.ai_keys for insert to authenticated
  with check ((scope = 'workspace' and private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])
               and not exists (select 1 from public.workspaces w where w.id = workspace_id and w.is_personal))
           or (scope = 'user' and user_id = (select auth.uid())));
create policy "ai_keys_update" on public.ai_keys for update to authenticated
  using ((scope = 'workspace' and private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
      or (scope = 'user' and user_id = (select auth.uid())));
create policy "ai_keys_delete" on public.ai_keys for delete to authenticated
  using ((scope = 'workspace' and private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
      or (scope = 'user' and user_id = (select auth.uid())));

-- The keys the caller's AI requests should use: for a Business workspace set
-- to "workspace", its keys; otherwise (Personal, "each person", or no
-- workspace) the caller's own. Server use only: ciphertext needs AI_KEYS_SECRET.
create function public.resolve_ai_keys(p_workspace uuid default null)
returns table (id uuid, provider text, ciphertext text, model text, status text, source text)
language plpgsql stable security definer set search_path = '' as $$
declare
  team boolean := false;
begin
  if p_workspace is not null then
    if not private.is_member(p_workspace) then return; end if;
    select not w.is_personal and w.ai_key_scope = 'workspace' into team from public.workspaces w where w.id = p_workspace;
  end if;
  if not private.is_active_user() then return; end if;
  return query
    select k.id, k.provider, k.ciphertext, k.model, k.status, k.scope
    from public.ai_keys k
    where (team and k.scope = 'workspace' and k.workspace_id = p_workspace)
       or (not coalesce(team, false) and k.scope = 'user' and k.user_id = (select auth.uid()));
end $$;
revoke execute on function public.resolve_ai_keys(uuid) from public, anon;
grant execute on function public.resolve_ai_keys(uuid) to authenticated;

-- One key's ciphertext, for the person who manages it (the "Test" button).
create function public.ai_key_for_test(p_key uuid)
returns table (provider text, ciphertext text, model text)
language sql stable security definer set search_path = '' as $$
  select k.provider, k.ciphertext, k.model from public.ai_keys k
  where k.id = p_key and private.is_active_user()
    and ((k.scope = 'workspace' and private.has_role(k.workspace_id, array['owner', 'admin']::public.workspace_role[]))
      or (k.scope = 'user' and k.user_id = (select auth.uid())));
$$;
revoke execute on function public.ai_key_for_test(uuid) from public, anon;
grant execute on function public.ai_key_for_test(uuid) to authenticated;

-- A request with a customer key failed (bad key, out of credit): mark it,
-- and tell the key's owner at most once a day. Anyone allowed to use the key
-- can report it; they still can't read or change the key itself.
create function public.report_ai_key_failure(p_key uuid, p_error text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  k public.ai_keys;
  recipient uuid;
begin
  select * into k from public.ai_keys where id = p_key;
  if k.id is null then return; end if;
  if not ((k.scope = 'workspace' and private.is_member(k.workspace_id)) or (k.scope = 'user' and k.user_id = (select auth.uid()))) then return; end if;
  update public.ai_keys set status = 'failed', last_error = left(p_error, 500), last_tested_at = now() where id = p_key;
  recipient := case when k.scope = 'user' then k.user_id else (
    select m.user_id from public.workspace_members m where m.workspace_id = k.workspace_id and m.role = 'owner' order by m.created_at limit 1) end;
  if recipient is not null and not exists (
    select 1 from public.notifications n
    where n.user_id = recipient and n.type = 'ai_key_failed' and n.data ->> 'key_id' = p_key::text and n.created_at > now() - interval '24 hours'
  ) then
    perform private.notify(recipient, 'ai_key_failed', 'Your AI key isn''t working',
      'Echo used its own AI keys instead. Check the key under Settings → AI models. Error: ' || left(p_error, 300),
      '/settings/ai', jsonb_build_object('key_id', p_key, 'provider', k.provider));
  end if;
end $$;
revoke execute on function public.report_ai_key_failure(uuid, text) from public, anon;
grant execute on function public.report_ai_key_failure(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Custom providers (any OpenAI-compatible endpoint: a local Ollama/vLLM/LM
-- Studio server, or another host). Managed by staff; usable by everyone when
-- enabled.
-- ---------------------------------------------------------------------------
create table public.ai_custom_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  base_url text not null check (base_url ~ '^https?://' and char_length(base_url) <= 300),
  ciphertext text check (char_length(ciphertext) <= 2000),
  last4 text check (char_length(last4) <= 8),
  model text not null check (char_length(model) between 1 and 100),
  enabled boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_custom_providers_created_by_idx on public.ai_custom_providers (created_by);
create trigger ai_custom_providers_updated_at before update on public.ai_custom_providers for each row execute function public.set_updated_at();

revoke all on public.ai_custom_providers from anon, authenticated;
grant select (id, name, base_url, last4, model, enabled, created_at, updated_at) on public.ai_custom_providers to authenticated;
grant insert (name, base_url, ciphertext, last4, model, enabled) on public.ai_custom_providers to authenticated;
grant update (name, base_url, ciphertext, last4, model, enabled) on public.ai_custom_providers to authenticated;
grant delete on public.ai_custom_providers to authenticated;
alter table public.ai_custom_providers enable row level security;
create policy "custom_providers_select" on public.ai_custom_providers for select to authenticated
  using (enabled or private.staff_can('ai.view'));
create policy "custom_providers_insert" on public.ai_custom_providers for insert to authenticated
  with check (private.staff_can('ai.manage'));
create policy "custom_providers_update" on public.ai_custom_providers for update to authenticated
  using (private.staff_can('ai.manage')) with check (private.staff_can('ai.manage'));
create policy "custom_providers_delete" on public.ai_custom_providers for delete to authenticated
  using (private.staff_can('ai.manage'));

-- Connection details for one enabled custom provider (server use; the key
-- needs AI_KEYS_SECRET).
create function public.resolve_custom_provider(p_id uuid)
returns table (id uuid, name text, base_url text, ciphertext text, model text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.base_url, c.ciphertext, c.model from public.ai_custom_providers c
  where c.id = p_id and (c.enabled or private.staff_can('ai.manage')) and private.is_active_user();
$$;
revoke execute on function public.resolve_custom_provider(uuid) from public, anon;
grant execute on function public.resolve_custom_provider(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- AI usage: one row per AI call (chat, summary, transcription, connector),
-- written by the server as the user. Cost is an estimate from the Super
-- Admin price table.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  feature text not null check (feature in ('chat', 'summary', 'transcription', 'mcp', 'test')),
  provider text not null check (char_length(provider) <= 40),
  model text check (char_length(model) <= 100),
  key_source text not null check (key_source in ('own', 'echo', 'custom')),
  fallback boolean not null default false,
  input_tokens int, output_tokens int, audio_seconds int,
  cost_cents numeric(12, 4),
  ok boolean not null default true,
  latency_ms int,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_workspace_idx on public.ai_usage (workspace_id, created_at desc);

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant insert (workspace_id, feature, provider, model, key_source, fallback, input_tokens, output_tokens, audio_seconds, cost_cents, ok, latency_ms, error)
  on public.ai_usage to authenticated;
alter table public.ai_usage enable row level security;
create policy "ai_usage_insert" on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));
create policy "ai_usage_select" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid())
      or (workspace_id is not null and private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[]))
      or private.staff_can('ai.view'));

-- ---------------------------------------------------------------------------
-- Super Admin views
-- ---------------------------------------------------------------------------
create function public.admin_ai_usage(days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(days => least(greatest(days, 1), 365));
begin
  if not private.staff_can('ai.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object('calls', count(*), 'failed', count(*) filter (where not ok),
        'fallbacks', count(*) filter (where fallback), 'cost_cents', coalesce(sum(cost_cents), 0),
        'echo_cost_cents', coalesce(sum(cost_cents) filter (where key_source <> 'own'), 0),
        'own_cost_cents', coalesce(sum(cost_cents) filter (where key_source = 'own'), 0))
      from public.ai_usage where created_at > since),
    'by_model', (select coalesce(jsonb_agg(x order by x.calls desc), '[]'::jsonb) from (
        select provider, model, feature, key_source, count(*) as calls, count(*) filter (where not ok) as failed,
               coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(output_tokens), 0) as output_tokens,
               coalesce(sum(audio_seconds), 0) as audio_seconds, coalesce(sum(cost_cents), 0) as cost_cents,
               round(avg(latency_ms)) as avg_latency_ms
        from public.ai_usage where created_at > since
        group by provider, model, feature, key_source) x),
    'by_workspace', (select coalesce(jsonb_agg(x order by x.cost_cents desc), '[]'::jsonb) from (
        select u.workspace_id, w.name, w.is_personal,
               (select e.email::text from public.workspace_members m join auth.users e on e.id = m.user_id
                where m.workspace_id = u.workspace_id and m.role = 'owner' order by m.created_at limit 1) as owner_email,
               count(*) as calls, coalesce(sum(u.cost_cents), 0) as cost_cents,
               count(*) filter (where u.key_source = 'own') as own_key_calls
        from public.ai_usage u left join public.workspaces w on w.id = u.workspace_id
        where u.created_at > since group by u.workspace_id, w.name, w.is_personal
        order by 5 desc limit 25) x)
  );
end $$;
revoke execute on function public.admin_ai_usage(int) from public, anon;
grant execute on function public.admin_ai_usage(int) to authenticated;

-- Customer keys at a glance: counts by provider and status (never the keys).
create function public.admin_ai_keys_overview()
returns table (provider text, scope text, ok bigint, failed bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('ai.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select k.provider, k.scope, count(*) filter (where k.status = 'ok'), count(*) filter (where k.status = 'failed')
    from public.ai_keys k group by k.provider, k.scope order by 1, 2;
end $$;
revoke execute on function public.admin_ai_keys_overview() from public, anon;
grant execute on function public.admin_ai_keys_overview() to authenticated;

-- AI settings (enabled models, defaults, prices) live in platform_settings
-- under key 'ai'; writes there now follow ai.manage as well as owner/admin.
create policy "settings_insert_ai" on public.platform_settings for insert to authenticated
  with check (key = 'ai' and private.staff_can('ai.manage'));
create policy "settings_update_ai" on public.platform_settings for update to authenticated
  using (key = 'ai' and private.staff_can('ai.manage')) with check (key = 'ai' and private.staff_can('ai.manage'));
