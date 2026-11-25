import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSmsBilling, type SmsBilling } from "./pricing";

// SMS billing reads: the price settings and a line's text balance.

export async function getSmsBilling(supabase: SupabaseClient): Promise<SmsBilling> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "sms_billing").maybeSingle();
  return parseSmsBilling(data?.value);
}

export type SmsUsage = { used: number; plan: number; free: number; packs: number; allowance: number; remaining: number; period_start: string };

/** The line owner's texts this month (null before the SMS billing migration). */
export async function lineSmsUsage(supabase: SupabaseClient, lineId: string): Promise<SmsUsage | null> {
  const { data, error } = await supabase.rpc("sms_line_usage", { p_line: lineId });
  if (error) return null;
  return (data as SmsUsage | null) ?? null;
}
