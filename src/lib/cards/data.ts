import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_TOTALS, normalizeDesign, normalizeLinks, type Card, type CardLead, type CardStats } from "./types";

// Business card reads for the admin (RLS: crm.view).

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : null);

export function rowToCard(r: Row): Card {
  return {
    id: r.id as string, owner_id: s(r.owner_id), status: (r.status as Card["status"]) ?? "draft", nfc_status: (r.nfc_status as Card["nfc_status"]) ?? "not_ordered",
    published_at: s(r.published_at), created_at: r.created_at as string, updated_at: r.updated_at as string,
    slug: r.slug as string, card_name: s(r.card_name), display_name: (r.full_name as string) ?? "", first_name: s(r.first_name), last_name: s(r.last_name),
    job_title: s(r.title), company_name: s(r.company), department: s(r.department), bio: s(r.bio), primary_email: s(r.email), primary_phone: s(r.phone),
    sms_phone: s(r.sms_phone), website_url: s(r.website), address: s(r.address), maps_url: s(r.maps_url), intro_video_url: s(r.intro_video_url),
    profile_photo_url: s(r.photo_url), logo_url: s(r.logo_url), background_image_url: s(r.background_image_url),
    accent_color: (r.accent as string) ?? "#18181b", background_color: (r.background_color as string) ?? "#ffffff", text_color: (r.text_color as string) ?? "#18181b",
    theme_mode: (r.theme as Card["theme_mode"]) ?? "light", links: normalizeLinks(r.links), design: normalizeDesign(r.design as Card["design"]),
  };
}

export async function listCards(): Promise<Card[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("business_cards").select("*").order("full_name");
  return (data ?? []).map(rowToCard);
}

export async function getCard(id: string): Promise<Card | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("business_cards").select("*").eq("id", id).maybeSingle();
  return data ? rowToCard(data) : null;
}

// Lifetime event counts per card.
export async function cardStats(): Promise<CardStats> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_events").select("card_id, kind").limit(100000);
  const stats: CardStats = {};
  for (const e of data ?? []) {
    const t = (stats[e.card_id] ??= { ...EMPTY_TOTALS });
    if (e.kind in t) t[e.kind as keyof typeof t] += 1;
  }
  return stats;
}

export async function listCardLeads(): Promise<CardLead[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_leads").select("*").order("created_at", { ascending: false }).limit(1000);
  return (data ?? []) as CardLead[];
}
