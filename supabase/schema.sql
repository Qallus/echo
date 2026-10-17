-- Illustrative schema for future authenticated Echo storage.
-- Not exposed via client yet. Enable and configure policies before production usage.
create extension if not exists pgcrypto;
create table if not exists public.echo_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table if not exists public.echo_sessions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.echo_workspaces(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Untitled recording', status text not null default 'draft',
 storage_path text, created_at timestamptz not null default now()
);
create table if not exists public.echo_transcripts (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.echo_sessions(id) on delete cascade,
 content text not null default '', created_at timestamptz not null default now()
);
alter table public.echo_workspaces enable row level security;
alter table public.echo_sessions enable row level security;
alter table public.echo_transcripts enable row level security;
-- No access policies supplied: deny client access by default until roles and memberships are implemented.
