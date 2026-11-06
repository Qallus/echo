import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactRecipients, sendToRecipients, templateBody, type Recipient } from "./send";
import { siteUrl } from "@/lib/notify/senders";

// Email automations. CRM actions queue runs as the signed-in staff member;
// /api/cron/comms (every 5 minutes) finds time-based ones and sends
// everything that's due. Each automation runs once per deal/contact and key.

export const TRIGGERS = [
  { id: "lead_created", label: "A lead is added", needs: "contact" },
  { id: "added_to_pipeline", label: "A deal is added to the pipeline", needs: "deal" },
  { id: "stage_changed", label: "A deal moves to a stage", needs: "deal" },
  { id: "closed_won", label: "A deal is won", needs: "deal" },
  { id: "closed_lost", label: "A deal is lost", needs: "deal" },
  { id: "next_step_overdue", label: "A deal's next step is overdue", needs: "deal" },
  { id: "deal_stalled", label: "A deal has had no activity for a while", needs: "deal" },
] as const;
export type Trigger = (typeof TRIGGERS)[number]["id"];

type Event = { dealId?: string | null; contactId?: string | null; stage?: string | null };

// Queue matching automations for a CRM event. Never throws: an automation
// problem must not block the change the user just made.
export async function queueAutomations(supabase: SupabaseClient, trigger: Trigger, events: Event[]) {
  try {
    if (!events.length) return;
    const { data: autos } = await supabase.from("email_automations").select("id, stage, delay_minutes").eq("trigger", trigger).eq("enabled", true);
    if (!autos?.length) return;
    const rows = autos.flatMap((a) => events
      .filter((e) => trigger !== "stage_changed" || !a.stage || a.stage === e.stage)
      .map((e) => ({
        automation_id: a.id, deal_id: e.dealId ?? null, contact_id: e.contactId ?? null,
        run_key: `${trigger}:${e.dealId ?? e.contactId}:${e.stage ?? ""}`, run_at: new Date(Date.now() + a.delay_minutes * 60_000).toISOString(),
      })));
    if (rows.length) await supabase.from("email_automation_runs").upsert(rows, { onConflict: "automation_id,run_key", ignoreDuplicates: true });
  } catch (e) {
    console.error("[automations]", e instanceof Error ? e.message : e);
  }
}

// Time-based triggers (service role, from the cron job).
export async function queueTimed(db: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: autos } = await db.from("email_automations").select("id, trigger, stalled_days, delay_minutes").in("trigger", ["next_step_overdue", "deal_stalled"]).eq("enabled", true);
  if (!autos?.length) return 0;
  const open = ["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation"];
  const rows: Record<string, unknown>[] = [];
  for (const a of autos) {
    if (a.trigger === "next_step_overdue") {
      const { data } = await db.from("crm_deals").select("id, next_step_due").in("stage", open).lt("next_step_due", today).limit(500);
      for (const d of data ?? []) rows.push({ automation_id: a.id, deal_id: d.id, run_key: `overdue:${d.id}:${d.next_step_due}` });
    } else {
      const cutoff = new Date(Date.now() - a.stalled_days * 86400_000).toISOString();
      const { data } = await db.from("crm_deals").select("id, updated_at").in("stage", open).lt("updated_at", cutoff).limit(500);
      for (const d of data ?? []) {
        const { count } = await db.from("crm_activities").select("id", { count: "exact", head: true }).eq("deal_id", d.id).gt("occurred_at", cutoff);
        if (!count) rows.push({ automation_id: a.id, deal_id: d.id, run_key: `stalled:${d.id}:${d.updated_at.slice(0, 10)}` });
      }
    }
  }
  if (rows.length) await db.from("email_automation_runs").upsert(rows, { onConflict: "automation_id,run_key", ignoreDuplicates: true });
  return rows.length;
}

// Sends every due run (service role, from the cron job).
export async function processDueRuns(db: SupabaseClient) {
  const { data: runs } = await db.from("email_automation_runs")
    .select("id, deal_id, contact_id, automation:email_automations(id, enabled, recipient, runs, template:email_templates(id, subject, preheader, schema, html, mode, status))")
    .eq("status", "queued").lte("run_at", new Date().toISOString()).order("run_at").limit(100);
  let sent = 0;
  for (const run of (runs ?? []) as unknown as Run[]) {
    const finish = (status: string, detail?: string) => db.from("email_automation_runs").update({ status, detail: detail?.slice(0, 500) ?? null }).eq("id", run.id);
    const a = run.automation;
    const body = a?.template ? templateBody(a.template) : null;
    if (!a?.enabled || !a.template || !body) { await finish("skipped", "Automation off or template missing."); continue; }
    if (a.template.status !== "active") { await finish("skipped", "The template is a draft or archived."); continue; }

    const { data: deal } = run.deal_id ? await db.from("crm_deals").select("id, title, stage, value_cents, currency, contact_id, owner_id").eq("id", run.deal_id).maybeSingle() : { data: null };
    let recipients: Recipient[] = [];
    if (a.recipient === "owner") {
      const ownerId = deal?.owner_id ?? (run.contact_id ? (await db.from("crm_contacts").select("owner_id").eq("id", run.contact_id).maybeSingle()).data?.owner_id : null);
      const owner = ownerId ? (await db.auth.admin.getUserById(ownerId)).data.user : null;
      if (owner?.email) recipients = [{ email: owner.email, deal_id: deal?.id ?? null, values: { email: owner.email, deal: deal?.title, site_url: siteUrl("/") } }];
    } else {
      const contactId = run.contact_id ?? deal?.contact_id;
      if (contactId) recipients = await contactRecipients(db, [contactId], deal);
    }
    if (!recipients.length) { await finish("skipped", "No recipient with an email address."); continue; }
    const res = await sendToRecipients(db, { subject: a.template.subject, ...body, templateId: a.template.id }, recipients);
    await finish(res.sent ? "sent" : res.skipped ? "skipped" : "failed", res.errors[0] ?? (res.skipped ? "Unsubscribed." : undefined));
    if (res.sent) { sent++; await db.from("email_automations").update({ runs: a.runs + 1 }).eq("id", a.id); }
  }
  return sent;
}

type Run = {
  id: string; deal_id: string | null; contact_id: string | null;
  automation: { id: string; enabled: boolean; recipient: "contact" | "owner"; runs: number; template: { id: string; subject: string; preheader: string | null; schema: unknown; html: string; mode: string; status: string } | null } | null;
};
