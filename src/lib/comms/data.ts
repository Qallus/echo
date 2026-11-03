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
