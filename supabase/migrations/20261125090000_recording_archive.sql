-- Archive for recordings: archived files leave All files and Unfiled but stay
-- searchable, openable and restorable. The existing recordings policies cover
-- the new column (members read; members edit).

alter table public.recordings add column if not exists archived_at timestamptz;

create index if not exists recordings_workspace_live
  on public.recordings (workspace_id, created_at desc)
  where deleted_at is null and archived_at is null;
