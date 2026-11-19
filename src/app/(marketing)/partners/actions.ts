"use server";

import { createClient } from "@/lib/supabase/server";

// The /partners forms. The database function validates, limits each address
// to 5 messages an hour, puts the request in the admin Inbox and adds or
// updates a CRM contact tagged by program.
export async function submitPartner(f: {
  program: string; name: string; email: string; phone?: string; company?: string; website?: string; location?: string;
  message: string; answers: Record<string, string>; consent: boolean; consentText: string; honeypot?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  if (f.honeypot) return { ok: true }; // bots fill the hidden field
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_partner_form", {
    p: {
      program: f.program, name: f.name?.slice(0, 200), email: f.email?.slice(0, 200), phone: f.phone?.slice(0, 40),
      company: f.company?.slice(0, 200), website: f.website?.slice(0, 300), location: f.location?.slice(0, 100),
      message: f.message?.slice(0, 10000), answers: f.answers, consent_contact: f.consent, consent_text: f.consentText,
    },
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't send. Please email hello@redial.si instead." };
  return { ok: true };
}
