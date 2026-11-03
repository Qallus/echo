import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EmailSchema } from "./blocks";

// Communications reads for the admin. RLS (comms.view / notifications.view)
// decides what comes back.

export type Template = { id: string; name: string; subject: string; preheader: string | null; category: string; schema: EmailSchema | null; sends: number; last_sent_at: string | null; updated_at: string };
export type Send = { id: string; template_id: string | null; to_email: string; subject: string; status: "sent" | "failed" | "skipped"; error: string | null; contact_id: string | null; deal_id: string | null; sent_by: string | null; created_at: string };
export type InboxMessage = {
  id: string; channel: "email" | "form"; from_name: string | null; from_email: string | null; phone: string | null; company: string | null; to_email: string | null;
  subject: string | null; body: string; topic: string | null; status: "new" | "read" | "archived"; contact_id: string | null; meta: { attachments?: { name?: string; type?: string; size?: number }[] }; created_at: string;
};
export type Delivery = { id: string; channel: "email" | "sms" | "push"; target: string | null; status: "sent" | "skipped" | "failed"; detail: string | null; created_at: string; notification: { type: string; title: string; user_id: string } | null };

export async function listTemplates(): Promise<Template[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("id, name, subject, preheader, category, schema, sends, last_sent_at, updated_at").order("updated_at", { ascending: false });
  return (data ?? []) as Template[];
}

export async function listSends(limit = 300): Promise<Send[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_sends").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Send[];
}

export async function listInbox(): Promise<InboxMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inbox_messages").select("*").order("created_at", { ascending: false }).limit(500);
  return (data ?? []) as InboxMessage[];
}

export async function listUnsubscribes(): Promise<{ email: string; created_at: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("email_unsubscribes").select("*").order("created_at", { ascending: false }).limit(500);
  return data ?? [];
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
