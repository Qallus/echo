-- SMS billing: texts priced at Redial's cost plus a markup (Admin → Billing →
-- SMS billing), sold as pay-as-you-go text packs (good for 12 months) and
-- monthly text plans. Every text segment (160 characters; 70 with emoji) sent
-- or received on a customer's line counts. Sending pauses when the balance
-- runs out; incoming texts always arrive. Plus scheduled texts from a line.

-- 1. Texts as their own meter in the catalog ---------------------------------
alter table public.catalog_products drop constraint if exists catalog_products_meter_check;
alter table public.catalog_products add constraint catalog_products_meter_check check (meter in ('transcription', 'redial', 'sms'));

-- Starting prices: about $0.0113 a text (Twilio $0.0083 + carrier fee $0.003),
-- plus 10%, with Stripe's fee covered. Change them in Admin → Billing → SMS billing.
insert into public.catalog_products (id, kind, name, tagline, features, per_seat, minutes, sort, meter, product_line) values
  ('sms_pack_1000', 'pack', '1,000 texts', 'Pay as you go. Good for 12 months.', array['1,000 text messages sent or received', 'Use them on any of your Redial lines', 'Good for 12 months'], false, 1000, 200, 'sms', 'redial'),
  ('sms_pack_5000', 'pack', '5,000 texts', 'Pay as you go. Good for 12 months.', array['5,000 text messages sent or received', 'Use them on any of your Redial lines', 'Good for 12 months'], false, 5000, 201, 'sms', 'redial'),
  ('sms_monthly_1000', 'bolt_on', 'Texts: 1,000 a month', 'A monthly text allowance for any Redial plan.', array['1,000 texts every month', 'Scheduled texts included', 'Unused texts reset monthly'], false, 1000, 210, 'sms', 'redial'),
  ('sms_monthly_5000', 'bolt_on', 'Texts: 5,000 a month', 'A monthly text allowance for any Redial plan.', array['5,000 texts every month', 'Scheduled texts included', 'Unused texts reset monthly'], false, 5000, 211, 'sms', 'redial')
on conflict (id) do nothing;
insert into public.catalog_prices (key, product_id, interval, unit_amount) values
  ('pack_sms_1000', 'sms_pack_1000', null, 1311),
  ('pack_sms_5000', 'sms_pack_5000', null, 6432),
  ('sms_monthly_1000', 'sms_monthly_1000', 'month', 1311),
  ('sms_monthly_5000', 'sms_monthly_5000', 'month', 6432)
on conflict (key) do nothing;

-- 2. Price settings (cents; read by everyone, changed by billing staff) ------
insert into public.platform_settings (key, value) values ('sms_billing',
  '{"costPerSegment": 0.83, "carrierFee": 0.30, "mmsCost": 2.20, "markupPercent": 10, "stripePercent": 2.9, "stripeFixedCents": 30, "freeTexts": 25}')
on conflict (key) do nothing;
create policy "settings_insert_sms_billing" on public.platform_settings for insert to authenticated
  with check (key = 'sms_billing' and (select private.staff_can('billing.manage')));
create policy "settings_update_sms_billing" on public.platform_settings for update to authenticated
  using (key = 'sms_billing' and (select private.staff_can('billing.manage')))
  with check (key = 'sms_billing' and (select private.staff_can('billing.manage')));

-- 3. Segments and Twilio's actual price on each text -------------------------
alter table public.phone_messages
  add column if not exists segments integer not null default 1 check (segments between 1 and 20),
  add column if not exists price_cents numeric(10, 4);
grant insert (segments) on public.phone_messages to authenticated;
grant select (segments, price_cents) on public.phone_messages to authenticated;
create index if not exists phone_messages_line_month on public.phone_messages (line_id, created_at) where line_id is not null;

-- 4. A line's text balance (counted for the line's owner, across their lines) -
create or replace function public.sms_line_usage(p_line uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := private.org_timezone();
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  owner uuid;
  plan_texts int;
  free_texts int;
  packs int;
  pack_used int;
  used int;
begin
  if not (private.can_text_line(p_line) or (select auth.role()) = 'service_role' or private.staff_can('users.view')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select l.owner_id into owner from public.redial_lines l where l.id = p_line;
  if owner is null then return null; end if;

  select coalesce(sum(p.minutes * greatest(coalesce((i ->> 'quantity')::int, 1), 1)), 0) into plan_texts
  from public.subscriptions s
  cross join lateral jsonb_array_elements(s.items) i
  join public.catalog_prices cp on cp.key = i ->> 'price_key'
  join public.catalog_products p on p.id = cp.product_id and p.meter = 'sms' and p.kind in ('bolt_on', 'plan')
  where s.user_id = owner and s.status in ('active', 'trialing', 'past_due');

  select coalesce((value ->> 'freeTexts')::int, 25) into free_texts from public.platform_settings where key = 'sms_billing';
  free_texts := coalesce(free_texts, 25);
  plan_texts := plan_texts + free_texts;

  select coalesce(sum(p.minutes * oi.quantity), 0) into packs
  from public.order_items oi
  join public.orders o on o.id = oi.order_id and o.user_id = owner and o.status = 'paid' and o.created_at > now() - interval '365 days'
  join public.catalog_prices cp on cp.key = oi.price_key
  join public.catalog_products p on p.id = cp.product_id and p.meter = 'sms' and p.kind = 'pack';

  -- Pack texts already spent: texts over the monthly allowance in earlier months.
  select coalesce(sum(greatest(m.n - plan_texts, 0)), 0) into pack_used from (
    select date_trunc('month', pm.created_at at time zone tz) as mon, sum(pm.segments)::int as n
    from public.phone_messages pm join public.redial_lines l on l.id = pm.line_id and l.owner_id = owner
    where pm.created_at > now() - interval '365 days' and pm.created_at < month_start and coalesce(pm.status, '') <> 'failed'
    group by 1) m;

  select coalesce(sum(pm.segments), 0)::int into used
  from public.phone_messages pm join public.redial_lines l on l.id = pm.line_id and l.owner_id = owner
  where pm.created_at >= month_start and coalesce(pm.status, '') <> 'failed';

  return jsonb_build_object(
    'used', used, 'plan', plan_texts, 'free', free_texts, 'packs', greatest(packs - pack_used, 0),
    'allowance', plan_texts + greatest(packs - pack_used, 0),
    'remaining', greatest(plan_texts + greatest(packs - pack_used, 0) - used, 0),
    'period_start', month_start);
end $$;
revoke execute on function public.sms_line_usage(uuid) from public, anon;
grant execute on function public.sms_line_usage(uuid) to authenticated, service_role;

-- 5. Scheduled texts from a line ----------------------------------------------
create table if not exists public.line_scheduled_texts (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.redial_lines (id) on delete cascade,
  to_numbers text[] not null check (cardinality(to_numbers) between 1 and 50),
  body text not null check (char_length(body) between 1 and 1600),
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'partly_sent', 'failed', 'canceled')),
  sent integer not null default 0,
  failed integer not null default 0,
  error text check (char_length(error) <= 2000),
  claimed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists line_scheduled_texts_due on public.line_scheduled_texts (send_at) where status = 'scheduled';
create index if not exists line_scheduled_texts_line on public.line_scheduled_texts (line_id, send_at desc);
alter table public.line_scheduled_texts enable row level security;
grant select on public.line_scheduled_texts to authenticated;
grant insert (line_id, to_numbers, body, send_at) on public.line_scheduled_texts to authenticated;
grant update (status) on public.line_scheduled_texts to authenticated;
create policy line_scheduled_texts_select on public.line_scheduled_texts for select to authenticated
  using ((select private.can_text_line(line_id)));
create policy line_scheduled_texts_insert on public.line_scheduled_texts for insert to authenticated
  with check ((select private.can_text_line(line_id)) and created_by = (select auth.uid()) and status = 'scheduled'
    and send_at > now() and send_at < now() + interval '180 days');
-- Cancel only, while it hasn't started.
create policy line_scheduled_texts_cancel on public.line_scheduled_texts for update to authenticated
  using ((select private.can_text_line(line_id)) and status = 'scheduled')
  with check (status = 'canceled');

-- 6. This month's texts on customer lines, for Admin → Billing → SMS billing.
create or replace function public.admin_sms_month()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := private.org_timezone();
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  out jsonb;
begin
  if not private.staff_can('billing.view') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'sent', coalesce(sum(segments) filter (where direction = 'outbound'), 0),
    'received', coalesce(sum(segments) filter (where direction = 'inbound'), 0),
    'twilio_cents', coalesce(sum(abs(price_cents)), 0),
    'priced', count(*) filter (where price_cents is not null),
    'messages', count(*),
    'lines', count(distinct line_id))
  into out from public.phone_messages
  where line_id is not null and created_at >= month_start and coalesce(status, '') <> 'failed';
  return out;
end $$;
revoke execute on function public.admin_sms_month() from public, anon;
grant execute on function public.admin_sms_month() to authenticated;
