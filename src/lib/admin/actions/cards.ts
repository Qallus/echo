"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { can, requireStaff } from "@/lib/admin/guard";
import { email, ref, text, type Result } from "@/lib/crm/validate";
import { getUser, isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_TOTALS, LINK_TYPES, normalizeDesign, slugify, type Card, type CardAnalytics, type CardStatus, type LeadStatus } from "@/lib/cards/types";

// Business cards. Staff with crm.view manage their own cards; crm.manage
// manages everyone's (enforced by RLS).

const HEX = /^#[0-9a-f]{6}$/i;
const STATUSES: CardStatus[] = ["draft", "published", "unpublished", "archived"];
const url = (v: unknown, max = 1000) => {
  const s = text(v, max);
  if (!s) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  return /^(https?:|mailto:|tel:|sms:)/i.test(withProto) ? withProto : null;
};
const done = () => revalidatePath("/admin/cards", "layout");

export async function saveCard(card: Card): Promise<Result> {
  const staff = await requireStaff("crm.view");
  const user = await getUser();
  const name = text(card.display_name, 120) ?? text([card.first_name, card.last_name].filter(Boolean).join(" "), 120);
  if (!name) return { error: "Enter the name shown on the card (Content → Display name)." };
  const slug = slugify(card.slug || name);
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return { error: "Use 2–60 letters, numbers and dashes for the card link (Settings)." };
  const mail = email(card.primary_email);
  if (mail === false) return { error: "Enter a valid email address." };
  const design = normalizeDesign(card.design);
  const status = STATUSES.includes(card.status) ? card.status : "draft";
  const row = {
    slug, card_name: text(card.card_name, 120) ?? name, status, owner_id: can(staff, "crm.manage") ? ref(card.owner_id) : user?.id ?? null,
    full_name: name, first_name: text(card.first_name, 60), last_name: text(card.last_name, 60), title: text(card.job_title, 120),
    company: text(card.company_name, 120), department: text(card.department, 120), bio: text(card.bio, 1000),
    email: mail, phone: text(card.primary_phone, 40), sms_phone: text(card.sms_phone, 40), website: url(card.website_url, 300), address: text(card.address, 300),
    maps_url: url(card.maps_url), intro_video_url: url(card.intro_video_url), photo_url: url(card.profile_photo_url), logo_url: url(card.logo_url),
    background_image_url: url(card.background_image_url),
    accent: HEX.test(card.accent_color) ? card.accent_color : "#18181b", background_color: HEX.test(card.background_color) ? card.background_color : "#ffffff",
    text_color: HEX.test(card.text_color) ? card.text_color : "#18181b", theme: ["light", "dark", "both"].includes(card.theme_mode) ? card.theme_mode : "light",
    nfc_status: ["not_ordered", "ordered", "assigned", "active"].includes(card.nfc_status) ? card.nfc_status : "not_ordered",
    links: card.links.slice(0, 30).map((l) => ({
      id: text(l.id, 60) ?? crypto.randomUUID(), label: text(l.label, 60) ?? "Link", url: url(l.url, 1000) ?? "",
      link_type: LINK_TYPES.includes(l.link_type) ? l.link_type : "custom", is_visible: l.is_visible !== false, open_in_new_tab: l.open_in_new_tab !== false,
    })),
    design, lead_capture: design.lead_form_settings.enabled,
    published_at: status === "published" ? card.published_at ?? new Date().toISOString() : card.published_at,
  };
  const supabase = await createClient();
  const isNew = !card.id;
  const res = isNew
    ? await supabase.from("business_cards").insert(row).select("id").single()
    : isUuid(card.id) ? await supabase.from("business_cards").update(row).eq("id", card.id).select("id").single() : null;
  if (!res) return { error: "Not found." };
  if (res.error) {
    return { error: res.error.code === "23505" ? "That card link is taken. Pick another in Settings." : res.error.code === "PGRST116" ? "You can only edit your own cards." : res.error.message };
  }
  await adminAudit(supabase, isNew ? "cards.create" : "cards.update", { type: "business_card", id: res.data.id }, { slug, status });
  done();
  return { ok: status === "published" ? "Published." : "Saved.", id: res.data.id };
}

export async function setCardStatus(id: string, status: CardStatus): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id) || !STATUSES.includes(status)) return { error: "Not found." };
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { data, error } = await supabase.from("business_cards").update(patch).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can only change your own cards." };
  await adminAudit(supabase, "cards.status", { type: "business_card", id }, { status });
  done();
  return { ok: status === "published" ? "Published." : status === "archived" ? "Archived." : "Unpublished." };
}

export async function setNfcStatus(id: string, nfc: "assigned" | "active"): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("business_cards").update({ nfc_status: nfc }).eq("id", id);
  if (error) return { error: error.message };
  done();
  return { ok: "NFC tag linked." };
}

export async function deleteCard(id: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_cards").delete().eq("id", id).select("slug");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can only delete your own cards." };
  await adminAudit(supabase, "cards.delete", { type: "business_card", id }, { slug: data[0].slug });
  done();
  return { ok: "Card deleted." };
}

export async function cardAnalytics(id: string, days: number): Promise<CardAnalytics | { error: string }> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const range = [7, 30, 90].includes(days) ? days : 30;
  const since = new Date(Date.now() - (range - 1) * 86400000);
  since.setHours(0, 0, 0, 0);
  const supabase = await createClient();
  const { data, error } = await supabase.from("card_events").select("kind, detail, created_at").eq("card_id", id).gte("created_at", since.toISOString()).limit(50000);
  if (error) return { error: error.message };
  const totals = { ...EMPTY_TOTALS };
  const daily = new Map<string, { views: number; clicks: number }>();
  for (let i = 0; i < range; i++) daily.set(new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10), { views: 0, clicks: 0 });
  const links = new Map<string, number>();
  for (const e of data ?? []) {
    if (e.kind in totals) totals[e.kind as keyof typeof totals] += 1;
    const d = daily.get(e.created_at.slice(0, 10));
    if (d && ["view", "qr", "nfc"].includes(e.kind)) d.views += 1;
    if (d && e.kind === "click") d.clicks += 1;
    if (e.kind === "click" && e.detail) links.set(e.detail, (links.get(e.detail) ?? 0) + 1);
  }
  return {
    days: range, totals,
    daily: [...daily].map(([date, v]) => ({ date: date.slice(5), ...v })),
    topLinks: [...links].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count })),
  };
}

export async function setLeadStatus(ids: string[], status: LeadStatus): Promise<Result> {
  await requireStaff("crm.view");
  const targets = ids.filter(isUuid).slice(0, 500);
  if (!targets.length || !["new", "contacted", "qualified", "archived"].includes(status)) return { error: "Select leads first." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("card_leads").update({ status }).in("id", targets).select("id");
  if (error) return { error: error.message };
  done();
  return { ok: `${data?.length ?? 0} updated.` };
}

export async function deleteCardLeads(ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = ids.filter(isUuid).slice(0, 500);
  if (!targets.length) return { error: "Select leads first." };
  const supabase = await createClient();
  const { error } = await supabase.from("card_leads").delete().in("id", targets);
  if (error) return { error: error.message };
  done();
  return { ok: `${targets.length} removed. Their CRM contacts stay.` };
}
