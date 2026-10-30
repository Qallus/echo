-- Echo: developer backlog, MCP audit log, recording search
-- Runs after 20261029220000_initial_schema.sql (uses its helpers and set_updated_at).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.dev_request_kind as enum ('feature', 'bug', 'content', 'design', 'question', 'task');
create type public.dev_request_area as enum ('frontend', 'dashboard', 'admin', 'api', 'mcp', 'database', 'other');
create type public.dev_request_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.dev_request_status as enum ('new', 'planned', 'in_progress', 'review', 'done', 'wont_do');

-- ---------------------------------------------------------------------------
-- Developer backlog
-- ---------------------------------------------------------------------------
create table public.dev_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  details text not null default '' check (char_length(details) <= 20000),
  kind public.dev_request_kind not null default 'feature',
  area public.dev_request_area not null default 'other',
  priority public.dev_request_priority not null default 'normal',
  status public.dev_request_status not null default 'new',
  -- where it was added: the dashboard, Claude (web/phone) or Claude Code
  source text not null default 'dashboard' check (source in ('dashboard', 'claude', 'claude_code', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- cursor pagination (created_at, id) within a workspace
create index dev_requests_workspace_created_idx on public.dev_requests (workspace_id, created_at desc, id desc);
create index dev_requests_workspace_status_idx on public.dev_requests (workspace_id, status);
create index dev_requests_created_by_idx on public.dev_requests (created_by);

create trigger dev_requests_updated_at before update on public.dev_requests
  for each row execute function public.set_updated_at();

create table public.dev_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dev_requests (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  -- shown instead of the author's name, e.g. "Claude Code"
  author_label text check (char_length(author_label) <= 80),
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index dev_request_comments_request_idx on public.dev_request_comments (request_id, created_at);
create index dev_request_comments_author_idx on public.dev_request_comments (author_id);

create function private.can_access_dev_request(req uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.dev_requests d
    join public.workspace_members m on m.workspace_id = d.workspace_id
    where d.id = req and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.can_access_dev_request(uuid) from public, anon;
grant execute on function private.can_access_dev_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- MCP audit log (append-only for clients)
-- ---------------------------------------------------------------------------
create table public.mcp_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  client_id text check (char_length(client_id) <= 200),
  tool text not null check (char_length(tool) <= 100),
  target_id text check (char_length(target_id) <= 200),
  ok boolean not null,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);
create index mcp_audit_log_user_created_idx on public.mcp_audit_log (user_id, created_at desc);
create index mcp_audit_log_workspace_idx on public.mcp_audit_log (workspace_id) where workspace_id is not null;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- Supabase's default privileges grant everything to anon/authenticated on new
-- tables, so set them explicitly.
-- ---------------------------------------------------------------------------
revoke all on public.dev_requests, public.dev_request_comments, public.mcp_audit_log from anon, authenticated;
grant select, insert, update, delete on public.dev_requests, public.dev_request_comments to authenticated;
grant select, insert on public.mcp_audit_log to authenticated;

alter table public.dev_requests enable row level security;
alter table public.dev_request_comments enable row level security;
alter table public.mcp_audit_log enable row level security;

-- backlog: members read/add/edit; creator or owner/admin deletes
create policy "dev_requests_select" on public.dev_requests for select to authenticated
  using (private.is_member(workspace_id));
create policy "dev_requests_insert" on public.dev_requests for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()));
create policy "dev_requests_update" on public.dev_requests for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "dev_requests_delete" on public.dev_requests for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_role(workspace_id, '{owner,admin}'));

-- comments: members read and add; authors edit or delete their own
create policy "dev_comments_select" on public.dev_request_comments for select to authenticated
  using (private.can_access_dev_request(request_id));
create policy "dev_comments_insert" on public.dev_request_comments for insert to authenticated
  with check (private.can_access_dev_request(request_id) and author_id = (select auth.uid()));
create policy "dev_comments_update" on public.dev_request_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "dev_comments_delete" on public.dev_request_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- audit: you see and write only your own rows; no update/delete grant at all
create policy "audit_select" on public.mcp_audit_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy "audit_insert" on public.mcp_audit_log for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or private.is_member(workspace_id)));

-- ---------------------------------------------------------------------------
-- Search: titles, transcripts and summaries. SECURITY INVOKER, so RLS applies.
-- ---------------------------------------------------------------------------
create index recordings_title_fts_idx on public.recordings using gin (to_tsvector('english', title));
create index transcript_segments_text_fts_idx on public.transcript_segments using gin (to_tsvector('english', text));
create index summaries_overview_fts_idx on public.summaries using gin (to_tsvector('english', overview));

create function public.search_recordings(query text, ws uuid default null, max_results integer default 20)
returns table (
  recording_id uuid,
  title text,
  source public.recording_source,
  created_at timestamptz,
  match_in text,
  snippet text,
  rank real
)
language sql stable security invoker set search_path = '' as $$
  with q as (
    select websearch_to_tsquery('english', query) as tsq
  ),
  hits as (
    select r.id, 'title'::text as match_in, r.title as body,
           ts_rank(to_tsvector('english', r.title), q.tsq) * 2 as rank
    from public.recordings r, q
    where to_tsvector('english', r.title) @@ q.tsq
    union all
    select s.recording_id, 'transcript', s.text, ts_rank(to_tsvector('english', s.text), q.tsq)
    from public.transcript_segments s, q
    where to_tsvector('english', s.text) @@ q.tsq
    union all
    select m.recording_id, 'summary', m.overview, ts_rank(to_tsvector('english', m.overview), q.tsq) * 1.5
    from public.summaries m, q
    where to_tsvector('english', m.overview) @@ q.tsq
  ),
  best as (
    select distinct on (h.id) h.id, h.match_in, h.body, h.rank
    from hits h
    order by h.id, h.rank desc
  )
  select r.id, r.title, r.source, r.created_at, b.match_in,
         ts_headline('english', b.body, q.tsq, 'MaxWords=30, MinWords=12, StartSel=**, StopSel=**'),
         b.rank
  from best b
  join public.recordings r on r.id = b.id
  cross join q
  where r.deleted_at is null and (ws is null or r.workspace_id = ws)
  order by b.rank desc, r.created_at desc
  limit least(greatest(coalesce(max_results, 20), 1), 50);
$$;
revoke execute on function public.search_recordings(text, uuid, integer) from public, anon;
grant execute on function public.search_recordings(text, uuid, integer) to authenticated;
