-- Prospects from Google Places: search a category and a city, add the
-- businesses found. Keeps each place's Google rating and review count, and
-- logs every search (it costs money) so it counts against the monthly cap.

alter table public.prospects
  add column if not exists rating numeric(2, 1) check (rating between 0 and 5),
  add column if not exists review_count integer check (review_count >= 0);

grant insert (latitude, longitude, geocoded_at, rating, review_count),
      update (rating, review_count)
  on public.prospects to authenticated;

create table if not exists public.places_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  query text not null check (char_length(query) between 1 and 200),
  page smallint not null default 1 check (page between 1 and 10),
  results integer not null default 0 check (results >= 0),
  cost_cents numeric(10, 3) not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);
create index if not exists places_searches_workspace_created_idx on public.places_searches (workspace_id, created_at);
create index if not exists places_searches_requested_by_idx on public.places_searches (requested_by);

revoke all on public.places_searches from anon, authenticated;
grant select on public.places_searches to authenticated;
grant insert (query, page, results, cost_cents) on public.places_searches to authenticated;
alter table public.places_searches enable row level security;

-- Redial's own searches: staff see them; only people who can spend on
-- prospecting (prospects.run: owner and admin) run them.
create policy "places_searches_select" on public.places_searches for select to authenticated
  using (workspace_id is null and (select private.staff_can('crm.view')));
create policy "places_searches_insert" on public.places_searches for insert to authenticated
  with check (workspace_id is null and (select private.staff_can('prospects.run')));

notify pgrst, 'reload schema';
