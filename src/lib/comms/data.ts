import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Audience } from "./audience";
import type { EmailSchema, TemplateMode, TemplateStatus } from "./blocks";

// Communications reads for the admin. RLS (comms.view / notifications.view)
// decides what comes back.

export type Template = {
  id: string; name: string; subject: string; preheader: string | null; category: string; status: TemplateStatus; mode: TemplateMode;
  schema: EmailSchema | null; html: string; revision: number; created_via: "admin" | "claude"; sends: number; last_sent_at: string | null; updated_at: string;
};
export type Campaign = {
  id: string; template_id: string | null; subject: string; audience_label: string | null; total: number; sent: number; skipped: number; failed: number;
  status: "sending" | "sent" | "partial" | "failed"; via: "admin" | "claude"; created_by: string | null; created_at: string; finished_at: string | null;
  stats: CampaignStats;
};
export type CampaignStats = { delivered: number; opened: number; clicked: number; bounced: number; complained: number };
export type SavedAudience = { id: string; name: string; description: string | null; definition: Audience; updated_at: string };
export type Send = { id: string; template_id: string | null; to_email: string; subject: string; status: "sent" | "failed" | "skipped" | "test"; error: string | null; campaign_id: string | null; contact_id: string | null; deal_id: string | null; sent_by: string | null; created_at: string;
  delivered_at: string | null; opened_at: string | null; clicked_at: string | null; bounced_at: string | null; complained_at: string | null;
  open_count: number; click_count: number; last_event: string | null };
export type Unsubscribe = { email: string; reason: "unsubscribed" | "bounced" | "complained"; created_at: string };
export type InboxMessage = {
  id: string; channel: "email" | "form"; from_name: string | null; from_email: string | null; phone: string | null; company: string | null; to_email: string | null;
  subject: string | null; body: string; topic: string | null; status: "new" | "read" | "archived"; contact_id: string | null; meta: { attachments?: { name?: string; type?: string; size?: number }[] }; created_at: string;
};
export type Delivery = { id: string; channel: "email" | "sms" | "push"; target: string | null; status: "sent" | "skipped" | "failed"; detail: string | null; created_at: string; notification: { type: string; title: string; user_id: string } | null };

export async function listTemplates(): Promise<Template[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("id, name, subject, preheader, category, status, mode, schema, html, revision, created_via, sends, last_sent_at, updated_at").order("updated_at", { ascending: false });
  return (data ?? []) as Template[];
}

export async function listSends(limit = 300): Promise<Send[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_sends").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Send[];
}

export async function listCampaigns(limit = 100): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_campaigns").select("id, template_id, subject, audience_label, total, sent, skipped, failed, status, via, created_by, created_at, finished_at")
    .order("created_at", { ascending: false }).limit(limit);
  const rows = data ?? [];
  // Delivery and engagement totals from Resend's events, per bulk send.
  const { data: stats } = rows.length ? await supabase.from("email_campaign_stats").select("campaign_id, delivered, opened, clicked, bounced, complained").in("campaign_id", rows.map((c) => c.id)) : { data: [] };
  const by = new Map((stats ?? []).map((x) => [x.campaign_id as string, x]));
  const zero = { delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
  return rows.map((c) => {
    const x = by.get(c.id);
    return { ...c, stats: x ? { delivered: Number(x.delivered), opened: Number(x.opened), clicked: Number(x.clicked), bounced: Number(x.bounced), complained: Number(x.complained) } : zero };
  }) as Campaign[];
}

export async function listAudiences(): Promise<SavedAudience[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_audiences").select("id, name, description, definition, updated_at").order("name");
  return (data ?? []) as SavedAudience[];
}

export async function listInbox(): Promise<InboxMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inbox_messages").select("*").order("created_at", { ascending: false }).limit(500);
  return (data ?? []) as InboxMessage[];
}

export async function listUnsubscribes(): Promise<Unsubscribe[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_unsubscribes").select("*").order("created_at", { ascending: false }).limit(500);
  return (data ?? []) as Unsubscribe[];
}

export async function listDeliveries(): Promise<Delivery[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_deliveries").select("id, channel, target, status, detail, created_at, notification:notifications(type, title, user_id)")
    .order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as unknown as Delivery[];
}

export type Text = { id: string; direction: "inbound" | "outbound"; from_number: string; to_number: string; body: string; status: string | null; error: string | null; media: { url?: string; type?: string }[]; contact_id: string | null; read_at: string | null; created_at: string };
export type PhoneCall = {
  id: string; direction: "inbound" | "outbound"; from_number: string | null; to_number: string | null; status: string; duration_seconds: number | null;
  recording_path: string | null; voicemail: boolean; transcript: string | null; transcript_status: string | null; notes: string | null;
  staff_id: string | null; contact_id: string | null; deal_id: string | null; created_at: string;
};
export type Automation = { id: string; name: string; trigger: string; stage: string | null; stalled_days: number; template_id: string; recipient: "contact" | "owner"; delay_minutes: number; enabled: boolean; runs: number };

export async function listTexts(): Promise<Text[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("phone_messages").select("id, direction, from_number, to_number, body, status, error, media, contact_id, read_at, created_at")
    .order("created_at", { ascending: false }).limit(1500);
  return (data ?? []) as Text[];
}

export async function listCalls(): Promise<PhoneCall[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("phone_calls").select("id, direction, from_number, to_number, status, duration_seconds, recording_path, voicemail, transcript, transcript_status, notes, staff_id, contact_id, deal_id, created_at")
    .order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as PhoneCall[];
}

export async function listOptOuts(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("phone_opt_outs").select("number").limit(2000);
  return (data ?? []).map((r) => r.number);
}

export async function listAutomations(): Promise<Automation[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_automations").select("id, name, trigger, stage, stalled_days, template_id, recipient, delay_minutes, enabled, runs").order("created_at");
  return (data ?? []) as Automation[];
}

export type Scheduled = {
  id: string; channel: "email" | "sms"; send_at: string; status: "scheduled" | "sending" | "sent" | "partial" | "failed" | "canceled";
  label: string | null; subject: string | null; content: { body?: string; kind?: string; templateId?: string | null }; total: number; sent: number; skipped: number; failed: number;
  progress: number; error: string | null; via: "admin" | "claude"; created_at: string; finished_at: string | null;
};

// Scheduled email and text sends (without the recipient lists), upcoming first.
export async function listScheduled(): Promise<Scheduled[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("scheduled_sends")
    .select("id, channel, send_at, status, label, subject, content, total, sent, skipped, failed, progress, error, via, created_at, finished_at")
    .order("send_at", { ascending: false }).limit(200);
  return (data ?? []) as Scheduled[];
}
