import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverScheduled } from "./email";
import { sendScheduledTexts } from "./sms-bulk";

// Scheduled email and text sends (table scheduled_sends). Staff schedule and
// cancel through server actions; the 5-minute job runs runScheduled() with
// the service role. A row is claimed before it's sent, so two runs never
// send the same thing; text sends that don't finish in one run carry on in
// the next from where they stopped.

export const SCHEDULE_MAX_DAYS = 90;

// A send time: an ISO date in the future (a little slack for "now"), at
// most SCHEDULE_MAX_DAYS ahead.
export function checkSendAt(iso: string | null | undefined): { at: Date } | { error: string } {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return { error: "Pick a date and time." };
  if (at.getTime() < Date.now() - 60_000) return { error: "That time has already passed." };
  if (at.getTime() > Date.now() + SCHEDULE_MAX_DAYS * 864e5) return { error: `Schedule at most ${SCHEDULE_MAX_DAYS} days ahead.` };
  return { at };
}

// The job has no signed-in person, so it records the run under whoever scheduled it.
async function audit(db: SupabaseClient, actor: string | null, id: string, detail: Record<string, unknown>) {
  const { error } = await db.from("admin_audit_log").insert({ actor, action: "comms.scheduled.run", target_type: "scheduled_send", target_id: id, detail });
  if (error) console.error("[scheduled audit]", error.message);
}

type Row = {
  id: string; channel: "email" | "sms"; content: unknown; recipients: unknown; label: string | null; via: "admin" | "claude"; created_by: string | null;
  progress: number; sent: number; skipped: number; failed: number;
};

export async function runScheduled(db: SupabaseClient, budgetMs = 200_000): Promise<number> {
  const deadline = Date.now() + budgetMs;
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  // Due, plus text sends that paused between runs (claimed_at cleared) or
  // whose run died (claimed over 10 minutes ago).
  const claimable = `and(status.eq.scheduled,send_at.lte.${now}),and(status.eq.sending,claimed_at.is.null),and(status.eq.sending,claimed_at.lt.${stale})`;
  const { data: due } = await db.from("scheduled_sends").select("id").or(claimable).order("send_at").limit(20);
  let handled = 0;
  for (const { id } of due ?? []) {
    if (Date.now() >= deadline) break;
    const { data: row } = await db.from("scheduled_sends").update({ status: "sending", claimed_at: new Date().toISOString() })
      .eq("id", id).or(claimable).select("id, channel, content, recipients, label, via, created_by, progress, sent, skipped, failed").maybeSingle<Row>();
    if (!row) continue; // someone else got it, or it was canceled
    handled++;

    if (row.channel === "email") {
      const res = await deliverScheduled(db, row);
      const status = res.error && !res.sent ? "failed" : res.failed ? "partial" : "sent";
      await db.from("scheduled_sends").update({
        status, sent: res.sent ?? 0, skipped: res.skipped ?? 0, failed: res.failed ?? 0, error: res.error?.slice(0, 1000) ?? null,
        campaign_id: res.campaignId ?? null, progress: (row.recipients as unknown[]).length, finished_at: new Date().toISOString(),
      }).eq("id", row.id);
      await audit(db, row.created_by, row.id, { channel: "email", status, sent: res.sent ?? 0, skipped: res.skipped ?? 0, failed: res.failed ?? 0, error: res.error ?? null });
      continue;
    }

    const res = await sendScheduledTexts(db, row, deadline);
    const finished = res.done || Boolean(res.error);
    const status = !finished ? "sending" : res.error && !res.sent ? "failed" : res.failed ? "partial" : "sent";
    await db.from("scheduled_sends").update({
      status, progress: res.progress, sent: res.sent, skipped: res.skipped, failed: res.failed, error: res.error?.slice(0, 1000) ?? null,
      claimed_at: null, ...(finished ? { finished_at: new Date().toISOString() } : {}),
    }).eq("id", row.id);
    if (finished) await audit(db, row.created_by, row.id, { channel: "sms", status, sent: res.sent, skipped: res.skipped, failed: res.failed, error: res.error ?? null });
  }
  return handled;
}
