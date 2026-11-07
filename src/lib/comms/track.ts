import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Resend delivery events -> email_sends (delivered, opened, clicked, …) and
// email_events. Hard bounces and spam complaints also go on the
// unsubscribe list so they're skipped from then on. Called only from the
// signed Resend webhook.
const TYPES: Record<string, string> = {
  "email.delivered": "delivered", "email.opened": "opened", "email.clicked": "clicked", "email.bounced": "bounced",
  "email.complained": "complained", "email.delivery_delayed": "delayed", "email.failed": "failed", "email.suppressed": "suppressed",
};

export type ResendEvent = {
  type?: string; created_at?: string;
  data?: {
    email_id?: string; to?: string[]; created_at?: string;
    click?: { link?: string }; bounce?: { type?: string; subType?: string; message?: string }; failed?: { reason?: string };
  };
};

export const isTrackingEvent = (type?: string) => !!type && type in TYPES;

export async function trackEvent(supabase: ReturnType<typeof createAdminClient>, svixId: string, event: ResendEvent) {
  const type = TYPES[event.type ?? ""];
  const id = event.data?.email_id;
  if (!type || !id) return { ok: true, ignored: true };
  const b = event.data?.bounce;
  const detail = type === "bounced" ? [b?.type, b?.subType, b?.message].filter(Boolean).join(" · ") : type === "failed" ? event.data?.failed?.reason : null;
  const { error } = await supabase.rpc("email_track_event", {
    p_svix_id: svixId, p_provider_id: id, p_type: type, p_at: event.created_at ?? event.data?.created_at ?? new Date().toISOString(),
    p_to: event.data?.to?.[0] ?? null, p_url: event.data?.click?.link ?? null, p_detail: detail || null,
    p_hard_bounce: type === "bounced" && b?.type === "Permanent",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
