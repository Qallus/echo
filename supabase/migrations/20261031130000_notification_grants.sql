-- Tighten notification table access. Supabase's default privileges give anon
-- and authenticated ALL on every new public table, so the column-level grants
-- in 20261031120000_notifications.sql didn't limit anything: a user could set
-- verified_at on their own channel (skipping the code) and read code hashes.
-- Revoke everything, then grant back only what the app uses.

revoke all on public.notifications, public.notification_preferences,
  public.notification_channels, public.notification_deliveries
from anon, authenticated;

-- Bell: read your own; the only change allowed is marking read.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Preferences: full control of your own rows.
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- Channels: add, read, rename and remove your own. Verification fields are
-- written only by channel_code_issue / channel_code_verify.
grant select (id, user_id, kind, address, label, verified_at, code_expires_at, created_at)
  on public.notification_channels to authenticated;
grant insert (user_id, kind, address, label, push_subscription) on public.notification_channels to authenticated;
grant update (label) on public.notification_channels to authenticated;
grant delete on public.notification_channels to authenticated;

-- Delivery log: Super Admin read only (RLS policy checks is_super_admin).
grant select on public.notification_deliveries to authenticated;
