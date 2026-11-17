-- Buying a phone number: people pick a real available number (/numbers),
-- pay for it at checkout, and the Stripe webhook buys it from Twilio, points
-- it at Redial and creates their line.
--
-- Price: $5.00 a month on its own, $2.50 a month with a Redial plan (checkout
-- picks the price). Change the amounts in Admin > Billing, then sync to Stripe.

insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort, meter, product_line) values
  ('redial_number', 'bolt_on', 'Phone number', 'A real local or toll-free number of your choice, answered by your Redial assistant.',
    array['Pick it yourself: area code, digits or a word', 'Calls answered and screened by your assistant', 'Works with the Redial app and desk phones', '$2.50 a month with any Redial plan'],
    false, null, 50, 'redial', 'redial')
on conflict (id) do nothing;

insert into public.catalog_prices (key, product_id, interval, unit_amount) values
  ('redial_number_monthly', 'redial_number', 'month', 500),
  ('redial_number_plan_monthly', 'redial_number', 'month', 250)
on conflict (key) do nothing;

-- One row per number bought at checkout. Written only by the Stripe webhook
-- (service role); the buyer and Redial staff can read it.
create table public.redial_number_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checkout_session_id text not null unique check (char_length(checkout_session_id) <= 200),
  picked_number text not null check (picked_number ~ '^\+[1-9][0-9]{7,14}$'),
  number text check (number ~ '^\+[1-9][0-9]{7,14}$'),
  price_key text check (char_length(price_key) <= 60),
  twilio_sid text check (twilio_sid ~ '^PN[0-9a-f]{32}$'),
  line_id uuid references public.redial_lines (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'needs_attention', 'released')),
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index redial_number_orders_user_idx on public.redial_number_orders (user_id, created_at desc);
create index redial_number_orders_status_idx on public.redial_number_orders (status) where status <> 'active';
create trigger redial_number_orders_updated_at before update on public.redial_number_orders for each row execute function public.set_updated_at();

revoke all on public.redial_number_orders from anon, authenticated;
grant select on public.redial_number_orders to authenticated;
grant all on public.redial_number_orders to service_role;
alter table public.redial_number_orders enable row level security;
create policy "redial_number_orders_select" on public.redial_number_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.staff_can('users.view')));

-- The webhook's way to create the buyer's line (and apply their setup
-- answers). Service role only.
create function public.redial_provision_line(p_user uuid, p_number text, p_label text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_number !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Invalid number'; end if;
  select id into v_id from public.redial_lines where number = p_number;
  if v_id is not null then return v_id; end if;
  insert into public.redial_lines (owner_id, number, label) values (p_user, p_number, coalesce(nullif(trim(p_label), ''), 'My line'))
  returning id into v_id;
  perform private.redial_setup_apply(p_user, v_id);
  return v_id;
end $$;
revoke execute on function public.redial_provision_line(uuid, text, text) from public, anon, authenticated;
grant execute on function public.redial_provision_line(uuid, text, text) to service_role;
