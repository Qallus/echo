-- Flow Studio (docs/IVR/REDIAL_FLOW_STUDIO_PLAN.md), step 1: storage for call
-- flows, their published versions, which lines run them, each call's path
-- through a flow, and the line's extensions.
--
-- * call_flows: one per flow, owned by a person. The draft is edited in the
--   studio; draft_rev guards against two people overwriting each other.
-- * call_flow_versions: immutable published copies, written only by
--   call_flow_publish(). Rolling back points the flow at an older version.
-- * call_flow_lines: which lines run the flow (one flow per line).
-- * call_flow_runs / call_flow_run_steps: a call's path, written only by the
--   Twilio webhooks (service role).
-- * redial_extensions: extension numbers on a line (101 → Sales).
--
-- Access: the flow's owner, or anyone with the new manage_flows capability on
-- a line the flow runs on. Recordings for Say / Play blocks come from the
-- owner's Recording Studio (studio_audio).

-- New line capability.
alter table public.redial_line_grants drop constraint redial_line_grants_capabilities_check;
alter table public.redial_line_grants add constraint redial_line_grants_capabilities_check check (
  cardinality(capabilities) between 1 and 11 and capabilities <@ array[
    'read_summary', 'read_transcript', 'manage_rules', 'monitor_live', 'takeover_live', 'direct_agent',
    'transfer_call', 'manage_directory', 'dial_custom_destination', 'mirror', 'manage_flows']::text[]);

-- ---------------------------------------------------------------------------
-- Flows and versions.
-- ---------------------------------------------------------------------------
create table public.call_flows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) < 524288),
  draft_rev integer not null default 0,
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index call_flows_owner_idx on public.call_flows (owner_id);
create index call_flows_draft_updated_by_idx on public.call_flows (draft_updated_by);

create table public.call_flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.call_flows (id) on delete cascade,
  version integer not null check (version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and pg_column_size(definition) < 524288),
  note text check (char_length(note) <= 300),
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (flow_id, version)
);
create index call_flow_versions_published_by_idx on public.call_flow_versions (published_by);

alter table public.call_flows add constraint call_flows_published_version_fk
  foreign key (published_version_id) references public.call_flow_versions (id) on delete set null;
create index call_flows_published_version_idx on public.call_flows (published_version_id);

-- Each draft save bumps the revision and records who saved it.
create function private.call_flow_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.draft is distinct from old.draft then
    new.draft_rev := old.draft_rev + 1;
    new.draft_updated_at := now();
    new.draft_updated_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function private.call_flow_touch() from public, anon, authenticated;
create trigger call_flows_touch before update on public.call_flows for each row execute function private.call_flow_touch();

create table public.call_flow_lines (
  line_id uuid primary key references public.redial_lines (id) on delete cascade,
  flow_id uuid not null references public.call_flows (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index call_flow_lines_flow_idx on public.call_flow_lines (flow_id);

-- Owner of the flow, or manage_flows on a line it runs on.
create function private.can_edit_flow(p_flow uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.call_flows f where f.id = p_flow and f.owner_id = (select auth.uid()))
      or exists (select 1 from public.call_flow_lines fl where fl.flow_id = p_flow and private.redial_can(fl.line_id, 'manage_flows'));
$$;
revoke execute on function private.can_edit_flow(uuid) from public, anon;
grant execute on function private.can_edit_flow(uuid) to authenticated;

revoke all on public.call_flows, public.call_flow_versions, public.call_flow_lines from anon, authenticated;
grant select, insert, delete on public.call_flows to authenticated;
grant update (name, description, draft) on public.call_flows to authenticated;
grant select on public.call_flow_versions to authenticated;
grant select, insert, delete on public.call_flow_lines to authenticated;

alter table public.call_flows enable row level security;
alter table public.call_flow_versions enable row level security;
alter table public.call_flow_lines enable row level security;

create policy "call_flows_select" on public.call_flows for select to authenticated
  using ((select private.can_edit_flow(id)));
create policy "call_flows_insert" on public.call_flows for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "call_flows_update" on public.call_flows for update to authenticated
  using ((select private.can_edit_flow(id))) with check ((select private.can_edit_flow(id)));
create policy "call_flows_delete" on public.call_flows for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "call_flow_versions_select" on public.call_flow_versions for select to authenticated
  using ((select private.can_edit_flow(flow_id)));

-- Attaching a flow to a line needs both: edit the flow and manage_flows on the line.
create policy "call_flow_lines_select" on public.call_flow_lines for select to authenticated
  using ((select private.can_edit_flow(flow_id)) or (select private.redial_can(line_id, 'manage_flows')));
create policy "call_flow_lines_insert" on public.call_flow_lines for insert to authenticated
  with check ((select private.can_edit_flow(flow_id)) and (select private.redial_can(line_id, 'manage_flows')));
create policy "call_flow_lines_delete" on public.call_flow_lines for delete to authenticated
  using ((select private.redial_can(line_id, 'manage_flows')));

-- Publish the current draft as the next version. The app validates the draft
-- (src/lib/flows/schema.ts) before calling this.
create function public.call_flow_publish(p_flow uuid, p_note text default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_draft jsonb;
  v_version integer;
  v_id uuid;
begin
  if not private.can_edit_flow(p_flow) then raise exception 'You can''t publish this flow.' using errcode = '42501'; end if;
  select draft into v_draft from public.call_flows where id = p_flow for update;
  if v_draft is null or v_draft = '{}'::jsonb then raise exception 'The flow is empty.' using errcode = '22023'; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.call_flow_versions where flow_id = p_flow;
  insert into public.call_flow_versions (flow_id, version, definition, note, published_by)
  values (p_flow, v_version, v_draft, nullif(left(trim(coalesce(p_note, '')), 300), ''), (select auth.uid()))
  returning id into v_id;
  update public.call_flows set published_version_id = v_id, updated_at = now() where id = p_flow;
  return v_version;
end $$;

-- Roll back: run an earlier version again, and copy it into the draft.
create function public.call_flow_rollback(p_flow uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_def jsonb;
begin
  if not private.can_edit_flow(p_flow) then raise exception 'You can''t change this flow.' using errcode = '42501'; end if;
  select id, definition into v_id, v_def from public.call_flow_versions where flow_id = p_flow and version = p_version;
  if v_id is null then raise exception 'That version doesn''t exist.' using errcode = '22023'; end if;
  update public.call_flows set published_version_id = v_id, draft = v_def where id = p_flow;
end $$;

revoke execute on function public.call_flow_publish(uuid, text), public.call_flow_rollback(uuid, integer) from public, anon;
grant execute on function public.call_flow_publish(uuid, text), public.call_flow_rollback(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Runs: a call's path through a flow. Written by the Twilio webhooks only.
-- ---------------------------------------------------------------------------
create table public.call_flow_runs (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.call_flows (id) on delete cascade,
  version_id uuid references public.call_flow_versions (id) on delete set null,
  line_id uuid references public.redial_lines (id) on delete set null,
  call_id uuid references public.redial_calls (id) on delete set null,
  call_sid text not null unique,
  from_number text,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  vars jsonb not null default '{}'::jsonb check (jsonb_typeof(vars) = 'object' and pg_column_size(vars) < 65536),
  current_node text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index call_flow_runs_flow_started_idx on public.call_flow_runs (flow_id, started_at desc);
create index call_flow_runs_version_idx on public.call_flow_runs (version_id);
create index call_flow_runs_line_idx on public.call_flow_runs (line_id);
create index call_flow_runs_call_idx on public.call_flow_runs (call_id);

create table public.call_flow_run_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.call_flow_runs (id) on delete cascade,
  seq integer not null,
  node_id text not null,
  node_type text not null,
  transition text,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 16384),
  started_at timestamptz not null default now(),
  duration_ms integer,
  unique (run_id, seq)
);

revoke all on public.call_flow_runs, public.call_flow_run_steps from anon, authenticated;
grant select on public.call_flow_runs, public.call_flow_run_steps to authenticated;
alter table public.call_flow_runs enable row level security;
alter table public.call_flow_run_steps enable row level security;
create policy "call_flow_runs_select" on public.call_flow_runs for select to authenticated
  using ((select private.can_edit_flow(flow_id)) or (line_id is not null and (select private.redial_can(line_id, 'read_summary'))));
create policy "call_flow_run_steps_select" on public.call_flow_run_steps for select to authenticated
  using (exists (select 1 from public.call_flow_runs r where r.id = run_id
    and ((select private.can_edit_flow(r.flow_id)) or (r.line_id is not null and (select private.redial_can(r.line_id, 'read_summary'))))));

-- ---------------------------------------------------------------------------
-- Extensions: dial 101 to reach Sales. A target is a Directory entry or a
-- number; an optional Studio recording plays as its voicemail greeting.
-- ---------------------------------------------------------------------------
create table public.redial_extensions (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  ext text not null check (ext ~ '^[0-9]{2,6}$'),
  name text not null check (char_length(name) between 1 and 80),
  directory_id uuid references public.redial_directory (id) on delete set null,
  number text check (number ~ '^\+[1-9]\d{7,14}$'),
  ring_seconds integer not null default 20 check (ring_seconds between 5 and 60),
  voicemail_audio_id uuid references public.studio_audio (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_id, ext),
  check (directory_id is not null or number is not null)
);
create index redial_extensions_directory_idx on public.redial_extensions (directory_id);
create index redial_extensions_audio_idx on public.redial_extensions (voicemail_audio_id);
create trigger redial_extensions_updated_at before update on public.redial_extensions for each row execute function public.set_updated_at();

revoke all on public.redial_extensions from anon, authenticated;
grant select, insert, delete on public.redial_extensions to authenticated;
grant update (ext, name, directory_id, number, ring_seconds, voicemail_audio_id) on public.redial_extensions to authenticated;
alter table public.redial_extensions enable row level security;
create policy "redial_extensions_select" on public.redial_extensions for select to authenticated
  using ((select private.redial_can(line_id, 'manage_flows')) or (select private.redial_can(line_id, 'transfer_call')));
create policy "redial_extensions_insert" on public.redial_extensions for insert to authenticated
  with check ((select private.redial_can(line_id, 'manage_flows')));
create policy "redial_extensions_update" on public.redial_extensions for update to authenticated
  using ((select private.redial_can(line_id, 'manage_flows'))) with check ((select private.redial_can(line_id, 'manage_flows')));
create policy "redial_extensions_delete" on public.redial_extensions for delete to authenticated
  using ((select private.redial_can(line_id, 'manage_flows')));
