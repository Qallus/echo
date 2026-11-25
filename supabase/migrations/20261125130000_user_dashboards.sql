-- Each person's Home dashboard: which cards, in which sections, in what
-- order and size, and what's hidden. One row per person, only theirs.

create table if not exists public.user_dashboards (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  layout jsonb not null check (pg_column_size(layout) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.user_dashboards enable row level security;
grant select, delete on public.user_dashboards to authenticated;
grant insert (user_id, layout, updated_at), update (layout, updated_at) on public.user_dashboards to authenticated;

create policy user_dashboards_select on public.user_dashboards for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_dashboards_insert on public.user_dashboards for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_dashboards_update on public.user_dashboards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_dashboards_delete on public.user_dashboards for delete to authenticated
  using (user_id = (select auth.uid()));
