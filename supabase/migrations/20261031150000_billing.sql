-- Echo: Stripe billing. Orders, order items, subscriptions and the Stripe
-- customer for each user. Only /api/stripe/webhook writes these (service role,
-- after verifying Stripe's signature); users read their own.

create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'paid' check (status in ('paid', 'open', 'refunded', 'partially_refunded', 'void')),
  kind text not null default 'checkout' check (kind in ('checkout', 'renewal')),
  email text,
  currency text not null default 'usd',
  subtotal int not null default 0,
  discount int not null default 0,
  tax int not null default 0,
  total int not null default 0,
  stripe_checkout_session_id text unique,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text,
  receipt_url text,
  invoice_pdf text,
  created_at timestamptz not null default now()
);
create index orders_user_recent on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  price_key text,
  description text not null,
  quantity int not null default 1,
  unit_amount int,
  amount int not null,
  interval text check (interval in ('month', 'year'))
);
create index order_items_order on public.order_items (order_id);

create table public.subscriptions (
  id text primary key, -- Stripe subscription id
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  items jsonb not null default '[]'::jsonb, -- [{ price_key, quantity }]
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user on public.subscriptions (user_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Supabase's default privileges grant ALL on new tables: start from nothing.
revoke all on public.billing_customers, public.orders, public.order_items, public.subscriptions from anon, authenticated;
grant select on public.billing_customers, public.orders, public.order_items, public.subscriptions to authenticated;
grant all on public.billing_customers, public.orders, public.order_items, public.subscriptions to service_role;

alter table public.billing_customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscriptions enable row level security;

create policy "orders_select_own" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or private.is_super_admin());
create policy "order_items_select_own" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or private.is_super_admin())));
create policy "subscriptions_select_own" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_super_admin());
create policy "billing_customers_select_own" on public.billing_customers for select to authenticated
  using (user_id = (select auth.uid()));
