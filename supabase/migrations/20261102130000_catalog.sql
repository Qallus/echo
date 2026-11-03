-- Echo Super Admin S4: the store catalog moves from code into the database
-- (edited in Admin > Billing), staff billing access by permission, and billing
-- settings. Prices map to Stripe by lookup_key; editing a price creates a new
-- Stripe Price and moves the lookup key to it (Stripe prices can't change).

create table public.catalog_products (
  id text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  kind text not null check (kind in ('plan', 'bolt_on', 'pack', 'service')),
  name text not null check (char_length(name) between 1 and 80),
  tagline text not null default '' check (char_length(tagline) <= 300),
  features text[] not null default '{}',
  per_seat boolean not null default false,
  minutes int check (minutes >= 0), -- plans: per month (per seat when per_seat); packs: minutes added
  sort int not null default 0,
  active boolean not null default true,
  stripe_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_prices (
  key text primary key check (key ~ '^[a-z0-9_]{1,60}$'), -- Stripe lookup_key
  product_id text not null references public.catalog_products (id) on update cascade on delete cascade,
  interval text check (interval in ('month', 'year')), -- null = one-time
  unit_amount int check (unit_amount >= 0),
  tiers jsonb check (tiers is null or jsonb_typeof(tiers) = 'array'), -- graduated per-seat tiers [{upTo, unitAmount}]
  active boolean not null default true,
  stripe_price_id text,
  updated_at timestamptz not null default now(),
  check (unit_amount is not null or tiers is not null)
);
create index catalog_prices_product_idx on public.catalog_prices (product_id);

create trigger catalog_products_updated_at before update on public.catalog_products for each row execute function public.set_updated_at();
create trigger catalog_prices_updated_at before update on public.catalog_prices for each row execute function public.set_updated_at();

-- Public read of what's for sale (the pricing page works signed out);
-- staff with billing.view also see inactive items. Writes: billing.manage.
revoke all on public.catalog_products, public.catalog_prices from anon, authenticated;
grant select on public.catalog_products, public.catalog_prices to anon, authenticated;
grant insert, update, delete on public.catalog_products, public.catalog_prices to authenticated;
alter table public.catalog_products enable row level security;
alter table public.catalog_prices enable row level security;

create policy "catalog_products_public" on public.catalog_products for select to anon using (active);
create policy "catalog_products_select" on public.catalog_products for select to authenticated
  using (active or private.staff_can('billing.view'));
create policy "catalog_products_write" on public.catalog_products for all to authenticated
  using (private.staff_can('billing.manage')) with check (private.staff_can('billing.manage'));
create policy "catalog_prices_public" on public.catalog_prices for select to anon using (active);
create policy "catalog_prices_select" on public.catalog_prices for select to authenticated
  using (active or private.staff_can('billing.view'));
create policy "catalog_prices_write" on public.catalog_prices for all to authenticated
  using (private.staff_can('billing.manage')) with check (private.staff_can('billing.manage'));

-- Seed: today's catalog (src/lib/billing/catalog.ts).
insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort) values
  ('pro', 'plan', 'Pro', 'For your own calls and meetings.', array['2,000 transcription minutes a month', 'Unlimited history and storage', 'Claude, ChatGPT and Grok in Ask Echo', 'Branded PDF and web reports', 'Claude connector'], false, 2000, 0),
  ('business', 'plan', 'Business', 'For teams that share recordings.', array['Everything in Pro, per seat', 'Shared Business workspace', 'Admins and member roles', 'The more seats, the lower the price per seat', 'Priority support'], true, 2000, 10),
  ('api', 'bolt_on', 'API & webhooks', 'Pipe recordings, transcripts and summaries into your platform.', '{}', false, null, 20),
  ('crm', 'bolt_on', 'CRM sync', 'Summaries and action items on HubSpot, Salesforce or GoHighLevel records.', '{}', false, null, 30),
  ('bot', 'bolt_on', 'Meeting bot', 'Joins Zoom, Meet and Teams from your calendar and records for you.', '{}', false, null, 40),
  ('phone', 'bolt_on', 'Phone line', 'A number that records and transcribes your calls.', '{}', false, null, 50),
  ('whitelabel', 'bolt_on', 'White-label', 'Your logo, colors and domain on share pages and emails.', '{}', false, null, 60),
  ('translate', 'bolt_on', 'Translation', 'Transcripts and summaries in 30+ languages.', '{}', false, null, 70),
  ('min500', 'pack', '500 minutes', 'Extra transcription minutes. Valid for 12 months.', '{}', false, 500, 80),
  ('min2000', 'pack', '2,000 minutes', 'Extra transcription minutes. Valid for 12 months.', '{}', false, 2000, 90),
  ('min5000', 'pack', '5,000 minutes', 'Extra transcription minutes. Valid for 12 months.', '{}', false, 5000, 100),
  ('onboarding', 'service', 'Guided onboarding', 'A 60-minute session to set up workspaces, templates and the Claude connector for your team.', '{}', false, null, 110),
  ('templates', 'service', 'Custom template pack', 'Three summary templates written for your calls (sales, support, interviews…).', '{}', false, null, 120),
  ('integration', 'service', 'Custom integration', 'We connect Echo to your platform with the API and webhooks. Scoped on a call first.', '{}', false, null, 130)
on conflict (id) do nothing;

insert into public.catalog_prices (key, product_id, interval, unit_amount, tiers) values
  ('pro_monthly', 'pro', 'month', 1500, null),
  ('pro_annual', 'pro', 'year', 14400, null),
  ('business_monthly', 'business', 'month', null, '[{"upTo":5,"unitAmount":2000},{"upTo":20,"unitAmount":1700},{"upTo":null,"unitAmount":1400}]'::jsonb),
  ('business_annual', 'business', 'year', null, '[{"upTo":5,"unitAmount":20000},{"upTo":20,"unitAmount":17000},{"upTo":null,"unitAmount":14000}]'::jsonb),
  ('bolt_api_monthly', 'api', 'month', 1900, null),
  ('bolt_crm_monthly', 'crm', 'month', 2900, null),
  ('bolt_bot_monthly', 'bot', 'month', 4900, null),
  ('bolt_phone_monthly', 'phone', 'month', 1500, null),
  ('bolt_whitelabel_monthly', 'whitelabel', 'month', 4900, null),
  ('bolt_translate_monthly', 'translate', 'month', 1000, null),
  ('pack_minutes_500', 'min500', null, 1000, null),
  ('pack_minutes_2000', 'min2000', null, 3500, null),
  ('pack_minutes_5000', 'min5000', null, 7500, null),
  ('svc_onboarding', 'onboarding', null, 29900, null),
  ('svc_templates', 'templates', null, 14900, null),
  ('svc_integration', 'integration', null, 150000, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Staff billing access by permission (finance and analysts, not only
-- owners/admins).
-- ---------------------------------------------------------------------------
create policy "orders_select_staff" on public.orders for select to authenticated using (private.staff_can('billing.view'));
create policy "order_items_select_staff" on public.order_items for select to authenticated using (private.staff_can('billing.view'));
create policy "subscriptions_select_staff" on public.subscriptions for select to authenticated using (private.staff_can('billing.view'));
create policy "billing_customers_select_staff" on public.billing_customers for select to authenticated using (private.staff_can('billing.view'));

-- Orders with the buyer's email and item summary, newest first.
create function public.admin_orders(max_rows int default 200)
returns table (id uuid, number bigint, user_id uuid, user_email text, status text, kind text, total int, currency text,
  items text, created_at timestamptz, refundable boolean, receipt_url text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('billing.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select o.id, o.number, o.user_id, coalesce(o.email, u.email::text), o.status, o.kind, o.total, o.currency,
           (select string_agg(i.description || case when i.quantity > 1 then ' × ' || i.quantity else '' end, ', ') from public.order_items i where i.order_id = o.id),
           o.created_at, o.stripe_payment_intent_id is not null and o.status in ('paid', 'partially_refunded'), o.receipt_url
    from public.orders o left join auth.users u on u.id = o.user_id
    order by o.created_at desc
    limit least(greatest(max_rows, 1), 1000);
end $$;
revoke execute on function public.admin_orders(int) from public, anon;
grant execute on function public.admin_orders(int) to authenticated;

-- Subscriptions with the subscriber's email, and churn inputs.
create function public.admin_subscriptions()
returns table (id text, user_id uuid, user_email text, status text, items jsonb, current_period_end timestamptz,
  cancel_at_period_end boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('billing.view') then raise exception 'Staff only' using errcode = '42501'; end if;
  return query
    select s.id, s.user_id, u.email::text, s.status, s.items, s.current_period_end, s.cancel_at_period_end, s.created_at, s.updated_at
    from public.subscriptions s left join auth.users u on u.id = s.user_id
    order by s.updated_at desc;
end $$;
revoke execute on function public.admin_subscriptions() from public, anon;
grant execute on function public.admin_subscriptions() to authenticated;

-- Billing settings (free minutes, own-key discount, limit enforcement) in
-- platform_settings under "billing".
insert into public.platform_settings (key, value)
values ('billing', '{"freeMinutes": 300, "byokDiscountPercent": 20, "enforceLimits": false}')
on conflict (key) do nothing;
create policy "settings_insert_billing" on public.platform_settings for insert to authenticated
  with check (key = 'billing' and private.staff_can('billing.manage'));
create policy "settings_update_billing" on public.platform_settings for update to authenticated
  using (key = 'billing' and private.staff_can('billing.manage')) with check (key = 'billing' and private.staff_can('billing.manage'));
