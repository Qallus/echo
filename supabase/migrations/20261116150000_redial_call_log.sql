-- Redial call log: every call on a line, in and out (desk phones included),
-- with the recording saved as an Echo recording (transcript, summary, action
-- items, Ask AI), the Twilio cost, and the owner's notes.
--
-- Lines choose whether calls are recorded and whether the other person hears
-- "This call may be recorded" (on by default: some states need everyone on
-- the call told).

alter table public.redial_lines
  add column record_calls boolean not null default true,
  add column record_notice boolean not null default true;
grant update (record_calls, record_notice) on public.redial_lines to authenticated;

alter table public.redial_calls
  add column direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  add column to_number text check (char_length(to_number) <= 40),
  add column device_id uuid references public.redial_devices (id) on delete set null,
  add column recording_id uuid references public.recordings (id) on delete set null,
  add column cost_cents numeric(10, 3) check (cost_cents >= 0),
  add column cost_checked_at timestamptz,
  add column notes text check (char_length(notes) <= 10000);

create index redial_calls_direction_idx on public.redial_calls (line_id, direction, started_at desc);
create index redial_calls_recording_idx on public.redial_calls (recording_id) where recording_id is not null;
-- Calls still waiting for Twilio's price (filled by the comms cron).
create index redial_calls_cost_pending_idx on public.redial_calls (ended_at) where cost_cents is null and twilio_sid is not null and ended_at is not null;

-- Readable columns (redial_calls grants select column by column). Also opens
-- the fraud-protection verdict and signals added on Nov 16 to the line's
-- people, for the inbox labels.
grant select (direction, to_number, device_id, recording_id, cost_cents, notes, verdict, risk_signals, stir_verstat, line_type)
  on public.redial_calls to authenticated;
grant update (notes) on public.redial_calls to authenticated;
