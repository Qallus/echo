-- Live Agents step 6: payments and payouts (Stripe Connect).
--
-- Business pays Redial up front through Stripe Checkout (shift, trial,
-- monthly) or saves a card (on-demand, billed per minute once calls are
-- connected). When work is completed, the agent's share is queued with a
-- 3-day hold for disputes, then transferred to their Stripe Express
-- account by the scheduled job (/api/cron/live-agents).
--
-- Payments and payouts are written only by Stripe's webhook and the
-- scheduled job (service role, after verifying Stripe's signature or
-- CRON_SECRET). People read their own side.

-- 1. The agent's Stripe Express account. Set once by the agent (through
-- the app's server action); payouts check the account's metadata matches.
create table public.live_agent_payout_accounts (
  agent_id uuid primary key references public.live_agents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);
create index live_agent_payout_accounts_user_idx on public.live_agent_payout_accounts (user_id);
revoke all on public.live_agent_payout_accounts from anon, authenticated;
grant select on public.live_agent_payout_accounts to authenticated;
alter table public.live_agent_payout_accounts enable row level security;
create policy "live_agent_payout_accounts_select_own" on public.live_agent_payout_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.live_agent_set_payout_account(acct text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a uuid;
begin
  select id into a from public.live_agents where user_id = auth.uid();
  if a is null then raise exception 'Create your Live Agent profile first.' using errcode = '22023'; end if;
  if acct !~ '^acct_[A-Za-z0-9]+$' then raise exception 'Not a Stripe account' using errcode = '22023'; end if;
  insert into public.live_agent_payout_accounts (agent_id, user_id, stripe_account_id) values (a, auth.uid(), acct)
  on conflict (agent_id) do nothing;
end $$;
revoke execute on function public.live_agent_set_payout_account(text) from public, anon;
grant execute on function public.live_agent_set_payout_account(text) to authenticated;

-- 2. Payments from businesses.
alter table public.live_agent_engagements
  add column paid_at timestamptz,
  add column completed_at timestamptz,
  add column disputed_at timestamptz,
  add column dispute_note text check (char_length(dispute_note) <= 2000);

create table public.live_agent_payments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.live_agent_engagements on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  payer_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('charge', 'card')), -- card: a saved card for on-demand billing
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  stripe_customer text,
  amount_cents int not null default 0 check (amount_cents >= 0), -- what the business paid, fee included
  base_cents int not null default 0 check (base_cents >= 0), -- the agent's rate part
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  status text not null default 'paid' check (status in ('paid', 'card_saved', 'refunded', 'partially_refunded')),
  created_at timestamptz not null default now()
);
create index live_agent_payments_engagement_idx on public.live_agent_payments (engagement_id);
create index live_agent_payments_workspace_idx on public.live_agent_payments (workspace_id, created_at desc);
create index live_agent_payments_payer_idx on public.live_agent_payments (payer_id);
revoke all on public.live_agent_payments from anon, authenticated;
grant select on public.live_agent_payments to authenticated;
alter table public.live_agent_payments enable row level security;
create policy "live_agent_payments_select" on public.live_agent_payments for select to authenticated
  using ((select private.has_role(workspace_id, array['owner', 'admin']::public.workspace_role[])));

-- 3. Payouts to agents.
create table public.live_agent_payouts (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.live_agent_engagements on delete cascade,
  agent_id uuid not null references public.live_agents on delete cascade,
  payment_id uuid unique references public.live_agent_payments on delete set null, -- one payout per payment (on-demand: one per weekly bill)
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'held', 'paid', 'failed', 'cancelled')),
  available_at timestamptz not null,
  stripe_transfer_id text unique,
  failure text check (char_length(failure) <= 500),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index live_agent_payouts_agent_idx on public.live_agent_payouts (agent_id, created_at desc);
create index live_agent_payouts_due_idx on public.live_agent_payouts (status, available_at);
create index live_agent_payouts_engagement_idx on public.live_agent_payouts (engagement_id);
revoke all on public.live_agent_payouts from anon, authenticated;
grant select on public.live_agent_payouts to authenticated;
alter table public.live_agent_payouts enable row level security;
create policy "live_agent_payouts_select_own" on public.live_agent_payouts for select to authenticated
  using (exists (select 1 from public.live_agents a where a.id = agent_id and a.user_id = (select auth.uid())));

-- 4. Queue the agent's share when work is completed (3-day hold).
create or replace function private.live_agent_queue_payout(e uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eng public.live_agent_engagements;
  pay public.live_agent_payments;
begin
  select * into eng from public.live_agent_engagements where id = e;
  select * into pay from public.live_agent_payments where engagement_id = e and kind = 'charge' and status in ('paid', 'partially_refunded')
    order by created_at desc limit 1;
  if pay.id is null then return; end if; -- nothing was charged (on-demand minutes are paid out when billed)
  insert into public.live_agent_payouts (engagement_id, agent_id, payment_id, amount_cents, available_at)
  values (e, eng.agent_id, pay.id,
          greatest(0, round((pay.base_cents - pay.refunded_cents * pay.base_cents::numeric / greatest(pay.amount_cents, 1)) * (1 - eng.agent_fee_pct / 100)))::int,
          now() + interval '3 days')
  on conflict (payment_id) do nothing;
end $$;
revoke execute on function private.live_agent_queue_payout(uuid) from public, anon, authenticated;

-- Replaces the step 5 version: "complete" also queues the payout, and
-- booked work needs payment before it starts.
create or replace function public.live_agent_respond(engagement uuid, action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  side text;
  next text;
  words text;
begin
  select * into e from public.live_agent_engagements where id = engagement for update;
  if e.id is null then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  side := private.live_agent_side(e.thread_id);
  if side is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  if action in ('accept', 'decline') then
    if e.status <> 'offered' or e.offered_by = side then raise exception 'You can''t answer this offer.' using errcode = '22023'; end if;
    next := case action when 'accept' then 'accepted' else 'declined' end;
  elsif action = 'withdraw' then
    if e.status <> 'offered' or e.offered_by <> side then raise exception 'You can''t withdraw this offer.' using errcode = '22023'; end if;
    next := 'withdrawn';
  elsif action = 'cancel' then
    if e.status not in ('accepted', 'active') then raise exception 'Only booked work can be cancelled.' using errcode = '22023'; end if;
    if e.paid_at is not null then raise exception 'This booking is paid. Report a problem and the Redial team will sort out a refund.' using errcode = '22023'; end if;
    next := 'cancelled';
  elsif action = 'complete' then
    if e.status <> 'active' or side <> 'business' then raise exception 'Only the business can mark paid, active work complete.' using errcode = '22023'; end if;
    next := 'completed';
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;

  update public.live_agent_engagements set status = next, responded_at = now(),
    completed_at = case when next = 'completed' then now() else completed_at end
  where id = engagement;
  if next = 'completed' then perform private.live_agent_queue_payout(engagement); end if;

  words := case next when 'accepted' then 'accepted the offer. Payment confirms the booking.' when 'declined' then 'declined the offer.'
    when 'withdrawn' then 'withdrew the offer.' when 'cancelled' then 'cancelled the booking.' else 'marked the work complete. Payment goes to the Live Agent after a 3-day hold.' end;
  perform private.live_agent_post(e.thread_id, 'system', 'system',
    case side when 'business' then (select business_name from public.live_agent_threads where id = e.thread_id)
              else (select display_name from public.live_agents where id = e.agent_id) end || ' ' || words, engagement);
end $$;

-- 5. Stripe's webhook records a payment (service role only).
create or replace function public.live_agent_record_payment(p jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  v_kind text := p->>'kind';
begin
  select * into e from public.live_agent_engagements where id = (p->>'engagement_id')::uuid for update;
  if e.id is null then return; end if;
  insert into public.live_agent_payments (engagement_id, workspace_id, payer_id, kind, stripe_session_id, stripe_payment_intent, stripe_customer, amount_cents, base_cents, status)
  values (e.id, e.workspace_id, nullif(p->>'payer_id', '')::uuid, v_kind, p->>'session_id', nullif(p->>'payment_intent', ''), nullif(p->>'customer', ''),
          coalesce((p->>'amount_cents')::int, 0), coalesce((p->>'base_cents')::int, 0), case v_kind when 'card' then 'card_saved' else 'paid' end)
  on conflict (stripe_session_id) do nothing;
  if not found then return; end if; -- already recorded (Stripe retries)
  if e.status = 'accepted' then
    update public.live_agent_engagements set status = 'active', paid_at = now() where id = e.id;
    perform private.live_agent_post(e.thread_id, 'system', 'system',
      case v_kind when 'card' then 'Card saved. The booking is active; minutes are billed weekly.' else 'Paid. The booking is confirmed.' end, e.id);
  end if;
end $$;
revoke execute on function public.live_agent_record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.live_agent_record_payment(jsonb) to service_role;

-- A refund (webhook): track it, and cancel an unpaid payout for a full refund.
create or replace function public.live_agent_record_refund(pi text, refunded int, total int)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.live_agent_payments set refunded_cents = refunded,
    status = case when refunded >= total then 'refunded' else 'partially_refunded' end
  where stripe_payment_intent = pi;
  if refunded >= total then
    update public.live_agent_payouts set status = 'cancelled' where status in ('pending', 'held')
      and payment_id in (select id from public.live_agent_payments where stripe_payment_intent = pi);
  end if;
end $$;
revoke execute on function public.live_agent_record_refund(text, int, int) from public, anon, authenticated;
grant execute on function public.live_agent_record_refund(text, int, int) to service_role;

-- 6. The business reports a problem within 72 hours of completion: the
-- payout is held for staff.
create or replace function public.live_agent_dispute(engagement uuid, note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.live_agent_engagements;
  s record;
begin
  select * into e from public.live_agent_engagements where id = engagement;
  if e.id is null or private.live_agent_side(e.thread_id) is distinct from 'business' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if e.paid_at is null then raise exception 'There''s no payment to dispute.' using errcode = '22023'; end if;
  if e.completed_at is not null and e.completed_at < now() - interval '72 hours' then
    raise exception 'Problems can be reported up to 72 hours after the work is complete. Contact support@redial.si.' using errcode = '22023';
  end if;
  if coalesce(trim(note), '') = '' then raise exception 'Tell us what went wrong.' using errcode = '22023'; end if;
  update public.live_agent_engagements set disputed_at = now(), dispute_note = left(note, 2000) where id = engagement;
  update public.live_agent_payouts set status = 'held' where engagement_id = engagement and status = 'pending';
  insert into public.live_agent_reports (thread_id, agent_id, reporter_id, reporter_side, reason, details)
  values (e.thread_id, e.agent_id, auth.uid(), 'business', 'other', 'Payment dispute: ' || left(note, 1900));
  perform private.live_agent_post(e.thread_id, 'system', 'system', 'The business reported a problem with this booking. The Redial team will review it; the payout is on hold.', engagement);
  for s in select user_id, role from public.platform_staff loop
    if 'marketplace.manage' = any(private.role_permissions(s.role)) then
      perform private.notify(s.user_id, 'live_agent_report', 'Live Agents: payment dispute', left(note, 140), '/admin/live-agents', jsonb_build_object('engagement_id', engagement));
    end if;
  end loop;
end $$;
revoke execute on function public.live_agent_dispute(uuid, text) from public, anon;
grant execute on function public.live_agent_dispute(uuid, text) to authenticated;

-- 7. Staff: payments and payouts, and releasing or holding a payout.
create or replace function public.admin_live_agent_money()
returns table (engagement_id uuid, agent_name text, business_name text, type text, eng_status text, paid_at timestamptz, completed_at timestamptz,
               disputed_at timestamptz, dispute_note text, payment_intent text, amount_cents int, refunded_cents int, payment_status text,
               payout_id uuid, payout_cents int, payout_status text, available_at timestamptz, transfer_id text, payout_failure text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.view') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select e.id, a.display_name, t.business_name, e.type, e.status, e.paid_at, e.completed_at, e.disputed_at, e.dispute_note,
           p.stripe_payment_intent, p.amount_cents, p.refunded_cents, p.status, o.id, o.amount_cents, o.status, o.available_at, o.stripe_transfer_id, o.failure
    from public.live_agent_engagements e
    join public.live_agent_threads t on t.id = e.thread_id
    join public.live_agents a on a.id = e.agent_id
    left join lateral (select * from public.live_agent_payments x where x.engagement_id = e.id order by x.created_at desc limit 1) p on true
    left join lateral (select * from public.live_agent_payouts y where y.engagement_id = e.id order by y.created_at desc limit 1) o on true
    where e.paid_at is not null
    order by (e.disputed_at is not null and o.status = 'held') desc, e.paid_at desc
    limit 300;
end $$;
revoke execute on function public.admin_live_agent_money() from public, anon;
grant execute on function public.admin_live_agent_money() to authenticated;

create or replace function public.admin_live_agent_payout(payout uuid, action text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('marketplace.manage') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if action = 'release' then
    update public.live_agent_payouts set status = 'pending', available_at = least(available_at, now()) where id = payout and status in ('held', 'failed');
  elsif action = 'hold' then
    update public.live_agent_payouts set status = 'held' where id = payout and status = 'pending';
  elsif action = 'cancel' then
    update public.live_agent_payouts set status = 'cancelled' where id = payout and status in ('pending', 'held', 'failed');
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end $$;
revoke execute on function public.admin_live_agent_payout(uuid, text) from public, anon;
grant execute on function public.admin_live_agent_payout(uuid, text) to authenticated;

-- 8. The scheduled job: finish booked work that has clearly ended (shifts
-- and trials 3 days after their date, monthly plans after 30 days).
create or replace function public.live_agent_auto_complete()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  e record;
  n int := 0;
begin
  for e in select id, thread_id from public.live_agent_engagements
           where status = 'active' and paid_at is not null and disputed_at is null and (
             (type in ('shift', 'trial') and coalesce(starts_on, paid_at::date) < current_date - 3)
             or (type = 'retainer' and paid_at < now() - interval '30 days')) loop
    update public.live_agent_engagements set status = 'completed', completed_at = now() where id = e.id;
    perform private.live_agent_queue_payout(e.id);
    perform private.live_agent_post(e.thread_id, 'system', 'system', 'This booking is complete. Payment goes to the Live Agent after a 3-day hold.', e.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.live_agent_auto_complete() from public, anon, authenticated;
grant execute on function public.live_agent_auto_complete() to service_role;
