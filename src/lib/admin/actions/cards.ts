"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { can, requireStaff } from "@/lib/admin/guard";
import { email, ref, text, type Result } from "@/lib/crm/validate";
import { getUser, isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Business cards. Staff with crm.view manage their own card; crm.manage
// manages everyone's (enforced by RLS).

type CardInput = {
  id?: string; slug: string; owner_id?: string | null; full_name: string; title?: string | null; company?: string | null; bio?: string | null; email?: string | null;
  phone?: string | null; website?: string | null; address?: string | null; photo_url?: string | null; logo_url?: string | null; accent?: string; theme?: string;
  links?: { label: string; url: string }[]; lead_capture?: boolean; active?: boolean;
};

const url = (v: unknown, max = 300) => {
  const s = text(v, max);
  if (!s) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  return /^(https?:|mailto:|tel:|sms:)/i.test(withProto) ? withProto : null;
};

export async function saveCard(input: CardInput): Promise<Result> {
  const staff = await requireStaff("crm.view");
  const user = await getUser();
  const slug = (input.slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return { error: "Use 2–60 lowercase letters, numbers and dashes for the link." };
  const name = text(input.full_name, 120);
  if (!name) return { error: "Enter the name on the card." };
  const mail = email(input.email);
  if (mail === false) return { error: "Enter a valid email address." };
  const links = (input.links ?? []).slice(0, 12).map((l) => ({ label: text(l.label, 40) ?? "", url: url(l.url, 500) ?? "" })).filter((l) => l.label && l.url);
  const owner = can(staff, "crm.manage") ? ref(input.owner_id) : user?.id ?? null;
  const row = {
    slug, owner_id: owner, full_name: name, title: text(input.title, 120), company: text(input.company, 120), bio: text(input.bio, 1000),
    email: mail, phone: text(input.phone, 40), website: url(input.website), address: text(input.address, 300),
    photo_url: url(input.photo_url, 1000), logo_url: url(input.logo_url, 1000),
    accent: /^#[0-9a-f]{6}$/i.test(input.accent ?? "") ? input.accent! : "#18181b", theme: input.theme === "dark" ? "dark" : "light",
    links, lead_capture: input.lead_capture !== false, active: input.active !== false,
  };
  const supabase = await createClient();
  const id = input.id;
  const isNew = !id;
  const res = !id
    ? await supabase.from("business_cards").insert(row).select("id").single()
    : isUuid(id) ? await supabase.from("business_cards").update(row).eq("id", id).select("id").single() : null;
  if (!res) return { error: "Not found." };
  if (res.error) return { error: res.error.code === "23505" ? "That link is taken. Try another." : res.error.code === "PGRST116" ? "You can only edit your own card." : res.error.message };
  await adminAudit(supabase, isNew ? "cards.create" : "cards.update", { type: "business_card", id: res.data.id }, { slug });
  revalidatePath("/admin/cards");
  return { ok: isNew ? "Card created." : "Saved.", id: res.data.id };
}

export async function deleteCard(id: string): Promise<Result> {
  await requireStaff("crm.view");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_cards").delete().eq("id", id).select("slug");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "You can only delete your own card." };
  await adminAudit(supabase, "cards.delete", { type: "business_card", id }, { slug: data[0].slug });
  revalidatePath("/admin/cards");
  return { ok: "Card deleted." };
}

export async function deleteCardLeads(ids: string[]): Promise<Result> {
  await requireStaff("crm.manage");
  const targets = ids.filter(isUuid).slice(0, 500);
  if (!targets.length) return { error: "Select leads first." };
  const supabase = await createClient();
  const { error } = await supabase.from("card_leads").delete().in("id", targets);
  if (error) return { error: error.message };
  revalidatePath("/admin/cards");
  return { ok: `${targets.length} removed. Their CRM contacts stay.` };
}
