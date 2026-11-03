-- Recordings: who each speaker is. Summaries: the dates mentioned and the
-- chosen summary chart. Calendar: each workspace's own appointments and
-- events, which can come from a recording.

-- {"Speaker A": {"name": "...", "email": "...", "avatarUrl": "...", "userId": "..."}}
alter table public.recordings
  add column speakers jsonb not null default '{}'::jsonb check (jsonb_typeof(speakers) = 'object' and pg_column_size(speakers) <= 16384);

alter table public.summaries
  add column dates jsonb not null default '[]'::jsonb check (jsonb_typeof(dates) = 'array' and pg_column_size(dates) <= 32768),
  add column visual text check (visual in ('mindmap', 'list', 'bars', 'timeline', 'kanban', 'pie', 'table'));

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  recording_id uuid references public.recordings (id) on delete set null,
  kind text not null default 'appointment' check (kind in ('appointment', 'event', 'deadline')),
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text check (char_length(location) <= 300),
  notes text check (char_length(notes) <= 5000),
  attendees jsonb not null default '[]'::jsonb check (jsonb_typeof(attendees) = 'array' and pg_column_size(attendees) <= 8192),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index calendar_events_workspace_starts_idx on public.calendar_events (workspace_id, starts_at);
create index calendar_events_recording_idx on public.calendar_events (recording_id);
create index calendar_events_created_by_idx on public.calendar_events (created_by);
create trigger calendar_events_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();

revoke all on public.calendar_events from anon, authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
alter table public.calendar_events enable row level security;
-- Any member of the workspace; a linked recording must be in the same workspace.
create policy "calendar_events_select" on public.calendar_events for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "calendar_events_insert" on public.calendar_events for insert to authenticated
  with check ((select private.is_member(workspace_id))
    and (recording_id is null or exists (select 1 from public.recordings r where r.id = recording_id and r.workspace_id = calendar_events.workspace_id)));
create policy "calendar_events_update" on public.calendar_events for update to authenticated
  using ((select private.is_member(workspace_id)))
  with check ((select private.is_member(workspace_id))
    and (recording_id is null or exists (select 1 from public.recordings r where r.id = recording_id and r.workspace_id = calendar_events.workspace_id)));
create policy "calendar_events_delete" on public.calendar_events for delete to authenticated
  using ((select private.is_member(workspace_id)));
