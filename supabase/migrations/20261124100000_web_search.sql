-- Web search for AI agents and staff (Perplexity via OpenRouter, Google
-- Programmable Search, Tavily). Every search is logged with its cost so
-- there's a monthly cap; settings live in platform_settings 'web_search'.

create table public.web_searches (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  provider text not null check (provider in ('perplexity', 'google', 'tavily')),
  query text not null check (char_length(query) between 1 and 400),
  kind text not null default 'search' check (kind in ('search', 'leads')),
  results integer not null default 0 check (results >= 0),
  cost_cents numeric(10, 3) not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);
create index web_searches_created_idx on public.web_searches (created_at desc);
create index web_searches_requested_by_idx on public.web_searches (requested_by);

revoke all on public.web_searches from anon, authenticated;
grant select on public.web_searches to authenticated;
grant insert (provider, query, kind, results, cost_cents) on public.web_searches to authenticated;
alter table public.web_searches enable row level security;

-- Staff who can see the CRM see the log; anyone allowed to research
-- (crm.view, so agents with CRM access too) can add to it.
create policy "web_searches_select" on public.web_searches for select to authenticated
  using ((select private.staff_can('crm.view')));
create policy "web_searches_insert" on public.web_searches for insert to authenticated
  with check ((select private.staff_can('crm.view')) and requested_by = (select auth.uid()));

-- Settings (default provider, prices, monthly cap): settings.manage.
create policy "settings_insert_web_search" on public.platform_settings for insert to authenticated
  with check (key = 'web_search' and (select private.staff_can('settings.manage')));
create policy "settings_update_web_search" on public.platform_settings for update to authenticated
  using (key = 'web_search' and (select private.staff_can('settings.manage')))
  with check (key = 'web_search' and (select private.staff_can('settings.manage')));

notify pgrst, 'reload schema';
