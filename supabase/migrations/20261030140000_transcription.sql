-- Echo: transcription. Platform-wide settings (Super Admin chooses the
-- transcription provider/model) and a place to explain failed jobs.

-- ---------------------------------------------------------------------------
-- Platform settings: non-secret choices only (API keys stay in env vars).
-- Everyone signed in can read them (jobs run as the user); only Super Admins write.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{1,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);
create index platform_settings_updated_by_idx on public.platform_settings (updated_by);

revoke all on public.platform_settings from anon, authenticated;
grant select, insert, update on public.platform_settings to authenticated;
alter table public.platform_settings enable row level security;

create policy "settings_select" on public.platform_settings for select to authenticated using (true);
create policy "settings_insert" on public.platform_settings for insert to authenticated
  with check (private.is_super_admin());
create policy "settings_update" on public.platform_settings for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value)
values ('transcription', '{"provider": "openai", "model": "gpt-4o-transcribe-diarize"}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Why the last transcription failed (shown on the recording page).
-- ---------------------------------------------------------------------------
alter table public.recordings add column processing_error text check (char_length(processing_error) <= 500);
