"use server";

import { createClient } from "@/lib/supabase/server";

// Public card page: analytics and "share your info". The database functions
// only accept active cards and limit leads per email.

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

export async function track(slug: string, kind: string, detail?: string) {
  if (!SLUG.test(slug)) return;
  const supabase = await createClient();
  await supabase.rpc("card_track", { p_slug: slug, p_kind: kind, p_detail: (detail ?? "").slice(0, 200) });
}

export async function shareInfo(input: { slug: string; name: string; email: string; phone: string; company: string; message: string; website?: string }): Promise<{ ok?: boolean; error?: string }> {
  if (input.website) return { ok: true }; // honeypot
  if (!SLUG.test(input.slug)) return { error: "Card not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("card_lead", {
    p_slug: input.slug, p_name: input.name.slice(0, 200), p_email: input.email.slice(0, 200), p_phone: input.phone.slice(0, 40),
    p_company: input.company.slice(0, 200), p_message: input.message.slice(0, 2000),
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't send that. Please try again." };
  return { ok: true };
}
