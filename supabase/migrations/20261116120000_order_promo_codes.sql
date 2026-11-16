-- Promo codes: each checkout order remembers the Stripe promotion code it
-- used, so Echo can enforce "uses per customer" and show how much each code
-- has given away. Written only by the Stripe webhook (service role); read
-- through the existing order policies (the customer's own orders, and staff
-- with billing.view).

alter table public.orders
  add column promo_code_id text check (char_length(promo_code_id) <= 100),
  add column promo_code text check (char_length(promo_code) <= 40);

create index orders_user_promo_idx on public.orders (user_id, promo_code_id) where promo_code_id is not null;
create index orders_promo_idx on public.orders (promo_code_id) where promo_code_id is not null;
