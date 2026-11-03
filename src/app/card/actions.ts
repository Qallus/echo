"use server";

import { normalizeDesign, type PublicCard } from "@/lib/cards/types";
import { emailHtml, sendEmail, sendSms, siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Public card page: analytics and "send me your info". The database
// functions only accept published cards and limit leads per email.

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

export async function track(slug: string, kind: string, detail?: string) {
  if (!SLUG.test(slug)) return;
  const supabase = await createClient();
  await supabase.rpc("card_track", { p_slug: slug, p_kind: kind, p_detail: (detail ?? "").slice(0, 200) });
}

export async function shareInfo(input: { slug: string; name?: string; email?: string; phone?: string; company?: string; message?: string; website?: string }): Promise<{ ok?: boolean; error?: string }> {
  if (input.website) return { ok: true }; // honeypot
  if (!SLUG.test(input.slug)) return { error: "Card not found." };
  const supabase = await createClient();
  const { data: raw } = await supabase.rpc("card_public", { p_slug: input.slug });
  const card = raw as PublicCard | null;
  if (!card) return { error: "Card not found." };
  const form = normalizeDesign(card.design).lead_form_settings;
  for (const f of form.fields) if (f.enabled && f.required && !String(input[f.key] ?? "").trim()) return { error: `Enter your ${f.label.toLowerCase()}.` };

  const v = { name: String(input.name ?? "").trim().slice(0, 200), email: String(input.email ?? "").trim().slice(0, 200), phone: String(input.phone ?? "").trim().slice(0, 40) };
  const { error } = await supabase.rpc("card_lead", {
    p_slug: input.slug, p_name: v.name, p_email: v.email, p_phone: v.phone,
    p_company: String(input.company ?? "").slice(0, 200), p_message: String(input.message ?? "").slice(0, 2000),
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't send that. Please try again." };

  // Card automations (Automations panel).
  const on = (a: string) => normalizeDesign(card.design).automations.find((x) => x.action === a && x.enabled);
  const summary = [v.email, v.phone].filter(Boolean).join(" · ");
  const jobs: Promise<unknown>[] = [];
  if (on("notify_owner_email") && card.primary_email) {
    const title = `New contact from your card: ${v.name}`;
    jobs.push(sendEmail(card.primary_email, title, emailHtml({ title, body: summary, url: siteUrl("/admin/cards?tab=leads"), cta: "Open leads" }), `${title}\n${summary}`));
  }
  if (on("notify_owner_sms") && card.primary_phone) jobs.push(sendSms(card.primary_phone, `Echo: new contact from your card, ${v.name}${summary ? ` (${summary})` : ""}.`));
  const reply = on("autoreply_email");
  if (reply && v.email) {
    const body = reply.message?.trim() || "Thanks for reaching out! I'll be in touch shortly.";
    const title = `Thanks, ${v.name.split(" ")[0] || "there"}`;
    jobs.push(sendEmail(v.email, title, emailHtml({ title, body, url: siteUrl(`/card/${card.slug}`), cta: `View ${card.display_name}'s card` }), `${body}\n\n${card.display_name}`,
      { replyTo: card.primary_email ?? undefined }));
  }
  await Promise.allSettled(jobs);
  return { ok: true };
}
