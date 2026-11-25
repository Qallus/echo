"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { twilioSmsPrices } from "@/lib/comms/twilio";
import { parseSmsBilling, type SmsBilling } from "@/lib/sms/pricing";
import { getSmsBilling } from "@/lib/sms/server";
import { createClient } from "@/lib/supabase/server";

// Admin → Billing → SMS billing: what a text costs Redial, the markup, and
// the free texts every line gets. Pack and plan prices are saved with the
// catalog's own savePrice (which also updates Stripe).

type Result = { ok?: string; error?: string };

export async function saveSmsBilling(input: SmsBilling): Promise<Result> {
  await requireStaff("billing.manage");
  const next = parseSmsBilling(input);
  const supabase = await createClient();
  const before = await getSmsBilling(supabase);
  const { error } = await supabase.from("platform_settings").upsert({ key: "sms_billing", value: next }, { onConflict: "key" });
  if (error) return { error: error.message };
  await adminAudit(supabase, "billing.sms.save", { type: "setting", id: "sms_billing" }, { from: before, to: next });
  revalidatePath("/admin/billing");
  return { ok: "Saved." };
}

/** Twilio's live US price per text, to fill in "Twilio price per segment". */
export async function fetchTwilioSmsPrice(): Promise<{ outbound?: number; inbound?: number; error?: string }> {
  await requireStaff("billing.view");
  const r = await twilioSmsPrices();
  return "error" in r ? { error: r.error } : { outbound: Math.round(r.outbound * 10000) / 10000, inbound: Math.round(r.inbound * 10000) / 10000 };
}
