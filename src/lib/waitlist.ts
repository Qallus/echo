"use server";

import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { CONSENT } from "./waitlist-options";

// The public "Get notified" form for the mobile apps. join_app_waitlist()
// validates, rate-limits, saves the entry and adds the person to the CRM as
// a lead, so they can get the app update emails, texts and calls they opted
// into. No account needed.
export async function joinWaitlist(f: Record<string, string | string[] | boolean>): Promise<{ ok?: boolean; error?: string }> {
  if (f.website) return { ok: true }; // honeypot: bots fill the hidden field
  const str = (k: string, n: number) => (typeof f[k] === "string" ? (f[k] as string).trim().slice(0, n) : "");
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const phone = toE164(str("phone", 40));
  if (!phone) return { error: "Enter a valid phone number, e.g. (480) 555-0142." };
  const sms = f.consent_sms === true, call = f.consent_call === true;
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_app_waitlist", {
    p: {
      first_name: str("first_name", 100), last_name: str("last_name", 100), email: str("email", 200), phone,
      platforms: list("platforms"), products: list("products"), account_type: str("account_type", 20),
      company: str("company", 200), team_size: str("team_size", 10), use_case: str("use_case", 100),
      details: str("details", 2000), questions: str("questions", 4000), consent_sms: sms, consent_call: call,
      consent_text: [CONSENT.email, sms && CONSENT.sms, call && CONSENT.call].filter(Boolean).join(" "),
      source_page: str("source_page", 200),
    },
  });
  if (error) return { error: ["22023", "54000"].includes(error.code ?? "") ? error.message : "Couldn't save that. Please try again." };
  return { ok: true };
}
