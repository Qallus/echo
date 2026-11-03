"use server";

import { createClient } from "@/lib/supabase/server";

// The public contact form. The database function validates the fields, limits
// each address to 5 messages an hour and puts it in the admin Inbox.
export async function submitContact(f: Record<string, string>): Promise<{ ok?: boolean; error?: string }> {
  if (f.website) return { ok: true }; // honeypot: bots fill the hidden field
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_form", {
    p_name: (f.name ?? "").slice(0, 200), p_email: (f.email ?? "").slice(0, 200), p_phone: (f.phone ?? "").slice(0, 40),
    p_company: (f.company ?? "").slice(0, 200), p_topic: (f.topic ?? "").slice(0, 60), p_message: (f.message ?? "").slice(0, 10000),
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't send. Please email us instead." };
  return { ok: true };
}
