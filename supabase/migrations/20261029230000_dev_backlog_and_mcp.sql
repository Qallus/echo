-- Echo: developer backlog (items added from phone/Claude), MCP audit log, search.

-- ---------------------------------------------------------------------------
-- Developer backlog
-- ---------------------------------------------------------------------------
create table public.dev_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  details text not null default '',
  kind text not null default 'feature'
    check (kind in ('feature', 'bug', 'content', 'design', 'question', 'task')),
  area text not null default 'dashboard'
    check (area in ('frontend', 'dashboard', 'admin', 'api', 'mcp', 'database', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'planned', 'in_progress', 'review', 'done', 'wont_do')),
  source text not null default 'web'
    check (source in ('web', 'phone', 'claude_code', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dev_requests_workspace_status_idx on public.dev_requests (workspace_id, status, created_at desc);
create index dev_requests_created_by_idx on public.dev_requests (created_by);
create trigger dev_requests_updated_at before update on public.dev_requests
  for each row execute function public.set_updated_at();

create table public.dev_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dev_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_label text, -- e.g. 'Claude Code', 'Claude (phone)'
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
-- MCP audit log (append-only from clients)
-- ---------------------------------------------------------------------------
create table public.mcp_audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  client_id text,           -- OAuth client_id claim (which app made the call)
  tool text not null,
  target_id text,           -- id of the row the tool touched, when there is one
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
create index mcp_audit_log_workspace_idx on public.mcp_audit_log (workspace_id, created_at desc);
create index mcp_audit_log_user_idx on public.mcp_audit_log (user_id);

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.dev_requests, public.dev_request_comments to authenticated, service_role;
grant select, insert on public.mcp_audit_log to authenticated;
grant select, insert, update, delete on public.mcp_audit_log to service_role;

alter table public.dev_requests enable row level security;
alter table public.dev_request_comments enable row level security;
alter table public.mcp_audit_log enable row level security;

create policy "dev_requests_select" on public.dev_requests for select to authenticated
  using (private.is_member(workspace_id));
create policy "dev_requests_insert" on public.dev_requests for insert to authenticated
  with check (private.is_member(workspace_id) and created_by = (select auth.uid()));
create policy "dev_requests_update" on public.dev_requests for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "dev_requests_delete" on public.dev_requests for delete to authenticated
  using (created_by = (select auth.uid()) or private.has_role(workspace_id, '{owner,admin}'));

create policy "dev_comments_select" on public.dev_request_comments for select to authenticated
  using (private.can_access_dev_request(request_id));
create policy "dev_comments_insert" on public.dev_request_comments for insert to authenticated
  with check (private.can_access_dev_request(request_id) and author_id = (select auth.uid()));
create policy "dev_comments_update" on public.dev_request_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "dev_comments_delete" on public.dev_request_comments for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "audit_insert" on public.mcp_audit_log for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(workspace_id));
create policy "audit_select" on public.mcp_audit_log for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role(workspace_id, '{owner,admin}'));

-- ---------------------------------------------------------------------------
-- Full-text search over titles, transcripts and summaries
-- ---------------------------------------------------------------------------
create index recordings_title_fts_idx on public.recordings using gin (to_tsvector('english', title));
create index transcript_segments_fts_idx on public.transcript_segments using gin (to_tsvector('english', text));
create index transcript_segments_recording_idx on public.transcript_segments (recording_id);
create index summaries_fts_idx on public.summaries using gin (to_tsvector('english', overview));

-- SECURITY INVOKER: runs as the caller, so RLS filters every row.
create function public.search_recordings(ws uuid, q text, max_results int default 20)
returns table (recording_id uuid, title text, match_in text, snippet text, rank real)
language sql stable security invoker set search_path = '' as $$
  with query as (select websearch_to_tsquery('english', q) as tsq)
  select * from (
    select r.id, r.title, 'title'::text, r.title, ts_rank(to_tsvector('english', r.title), query.tsq)
    from public.recordings r, query
    where r.workspace_id = ws and r.deleted_at is null and to_tsvector('english', r.title) @@ query.tsq
    union all
    select r.id, r.title, 'transcript', s.text, ts_rank(to_tsvector('english', s.text), query.tsq)
    from public.transcript_segments s join public.recordings r on r.id = s.recording_id, query
    where r.workspace_id = ws and r.deleted_at is null and to_tsvector('english', s.text) @@ query.tsq
    union all
    select r.id, r.title, 'summary', su.overview, ts_rank(to_tsvector('english', su.overview), query.tsq)
    from public.summaries su join public.recordings r on r.id = su.recording_id, query
    where r.workspace_id = ws and r.deleted_at is null and to_tsvector('english', su.overview) @@ query.tsq
  ) hits (recording_id, title, match_in, snippet, rank)
  order by rank desc
  limit least(greatest(max_results, 1), 100);
$$;
revoke execute on function public.search_recordings(uuid, text, int) from public, anon;
grant execute on function public.search_recordings(uuid, text, int) to authenticated;
