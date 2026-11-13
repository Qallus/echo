"use server";

import { toE164 } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Interest from the public pages: people who want to become Live Agents and
// businesses that want coverage. live_agent_interest() validates,
// rate-limits, saves the entry, adds a CRM lead and tells staff. No account
// needed.

const SMS_CONSENT = "Text me about Redial Live Agents. Message frequency varies. Msg & data rates may apply. Reply STOP to stop, HELP for help.";

export async function sendLiveAgentInterest(f: Record<string, string | string[] | boolean>): Promise<{ ok?: boolean; error?: string }> {
  if (f.website) return { ok: true }; // honeypot
  const str = (k: string, n: number) => (typeof f[k] === "string" ? (f[k] as string).trim().slice(0, n) : "");
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]).slice(0, 20).map((x) => String(x).slice(0, 60)) : []);
  const rawPhone = str("phone", 40);
  const phone = rawPhone ? toE164(rawPhone) : "";
  if (rawPhone && !phone) return { error: "Enter a valid phone number, e.g. (480) 555-0142." };
  const sms = f.consent_sms === true && Boolean(phone);
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_interest", {
    p: {
      kind: f.kind === "business" ? "business" : "agent",
      first_name: str("first_name", 100), last_name: str("last_name", 100), email: str("email", 200), phone,
      company: str("company", 200), city: str("city", 100), years: str("years", 10), hours: str("hours", 200),
      note: str("note", 2000), languages: list("languages"), skills: list("skills"), source_page: str("source_page", 200),
      consent_sms: sms, consent_text: sms ? SMS_CONSENT : "",
    },
  });
  if (error) {
    if (["22023", "54000"].includes(error.code ?? "")) return { error: error.message };
    if (error.code === "PGRST202") return { error: "Sign-ups open soon. Please try again later." };
    return { error: "Couldn't send that. Please try again." };
  }
  return { ok: true };
}
