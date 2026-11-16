-- Caller verification and fraud protection (every plan).
--
-- Per line: a family code word (encrypted by the app; the AI never sees it,
-- the server only answers "match" or "no match"), the family members a
-- scammer might pretend to be (for the call-back check), and trusted
-- contacts (a son, daughter or caregiver) who get a text when Redial stops a
-- likely scam and, if they choose, a weekly summary. Trusted contacts don't
-- need an Echo account; they opt in by replying YES to a text.
--
-- Each screened call gets a verdict (legit / unverified / likely_scam) and
-- the signals behind it.

-- ---------------------------------------------------------------------------
-- Settings: one row per line
-- ---------------------------------------------------------------------------
create table public.redial_protection (
  line_id uuid primary key references public.redial_lines (id) on delete cascade,
  enabled boolean not null default true,
  code_word_cipher text check (char_length(code_word_cipher) <= 500),
  has_code_word boolean generated always as (code_word_cipher is not null) stored,
  auto_block_scams boolean not null default true,
  warn_on_courier boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger redial_protection_updated_at before update on public.redial_protection for each row execute function public.set_updated_at();

-- The people a caller might claim to be. callback_ok: Redial may call them to
-- check they're safe while a caller is on hold.
create table public.redial_family (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  relationship text check (char_length(relationship) <= 40),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  callback_ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index redial_family_line_idx on public.redial_family (line_id);

-- Who hears about stopped scams. Only the owner adds them; only the server
-- (their YES reply, or STOP) sets the consent fields.
create table public.redial_trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  alert_scams boolean not null default true,
  weekly_summary boolean not null default true,
  invited_at timestamptz,
  sms_consent_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index redial_trusted_line_idx on public.redial_trusted_contacts (line_id);
create index redial_trusted_phone_idx on public.redial_trusted_contacts (phone);

-- One alert per call per contact (so retries never double-text anyone).
create table public.redial_protection_alerts (
  call_id uuid not null references public.redial_calls (id) on delete cascade,
  contact_id uuid not null references public.redial_trusted_contacts (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  sent_at timestamptz not null default now(),
  primary key (call_id, contact_id, channel)
);

-- ---------------------------------------------------------------------------
-- Calls: the verdict and the signals behind it
-- ---------------------------------------------------------------------------
alter table public.redial_calls
  add column verdict text check (verdict in ('legit', 'unverified', 'likely_scam')),
  add column risk_signals jsonb not null default '[]'::jsonb check (jsonb_typeof(risk_signals) = 'array' and pg_column_size(risk_signals) <= 8192),
  add column stir_verstat text check (char_length(stir_verstat) <= 60),
  add column line_type text check (char_length(line_type) <= 40),
  add column linked_call_id uuid references public.redial_calls (id) on delete set null;
create index redial_calls_verdict_idx on public.redial_calls (line_id, verdict, started_at desc) where verdict is not null;

-- The owner can correct a verdict, like the category.
grant update (verdict) on public.redial_calls to authenticated;

-- ---------------------------------------------------------------------------
-- Access: the line's owner (the server uses the service role)
-- ---------------------------------------------------------------------------
grant select (line_id, enabled, has_code_word, auto_block_scams, warn_on_courier, updated_at) on public.redial_protection to authenticated;
grant insert (line_id, enabled, code_word_cipher, auto_block_scams, warn_on_courier),
      update (enabled, code_word_cipher, auto_block_scams, warn_on_courier) on public.redial_protection to authenticated;
alter table public.redial_protection enable row level security;
create policy "redial_protection_select" on public.redial_protection for select to authenticated using ((select private.owns_redial_line(line_id)));
create policy "redial_protection_insert" on public.redial_protection for insert to authenticated with check ((select private.owns_redial_line(line_id)));
create policy "redial_protection_update" on public.redial_protection for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));

grant select, delete on public.redial_family to authenticated;
grant insert (line_id, name, relationship, phone, callback_ok), update (name, relationship, phone, callback_ok) on public.redial_family to authenticated;
alter table public.redial_family enable row level security;
create policy "redial_family_select" on public.redial_family for select to authenticated using ((select private.owns_redial_line(line_id)));
create policy "redial_family_insert" on public.redial_family for insert to authenticated with check ((select private.owns_redial_line(line_id)));
create policy "redial_family_update" on public.redial_family for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));
create policy "redial_family_delete" on public.redial_family for delete to authenticated using ((select private.owns_redial_line(line_id)));

grant select, delete on public.redial_trusted_contacts to authenticated;
grant insert (line_id, name, phone, email, alert_scams, weekly_summary),
      update (name, phone, email, alert_scams, weekly_summary) on public.redial_trusted_contacts to authenticated;
alter table public.redial_trusted_contacts enable row level security;
create policy "redial_trusted_select" on public.redial_trusted_contacts for select to authenticated using ((select private.owns_redial_line(line_id)));
create policy "redial_trusted_insert" on public.redial_trusted_contacts for insert to authenticated with check ((select private.owns_redial_line(line_id)));
create policy "redial_trusted_update" on public.redial_trusted_contacts for update to authenticated
  using ((select private.owns_redial_line(line_id))) with check ((select private.owns_redial_line(line_id)));
create policy "redial_trusted_delete" on public.redial_trusted_contacts for delete to authenticated using ((select private.owns_redial_line(line_id)));

-- A changed number has to opt in again.
create function private.redial_trusted_reset() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.sms_consent_at := null; new.invited_at := null; new.opted_out_at := null;
  end if;
  return new;
end $$;
revoke execute on function private.redial_trusted_reset() from public, anon, authenticated;
create trigger redial_trusted_reset before update of phone on public.redial_trusted_contacts
  for each row execute function private.redial_trusted_reset();

-- Alerts log: owner can see what was sent; only the server writes it.
grant select on public.redial_protection_alerts to authenticated;
alter table public.redial_protection_alerts enable row level security;
create policy "redial_protection_alerts_select" on public.redial_protection_alerts for select to authenticated
  using (exists (select 1 from public.redial_calls c where c.id = call_id and c.owner_id = (select auth.uid())));
