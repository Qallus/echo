"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { twilioSms, e164 } from "@/lib/comms/twilio";
import { myLines } from "@/lib/redial/data";
import { segmentsOf } from "@/lib/sms/pricing";
import { lineSmsUsage } from "@/lib/sms/server";
import { createClient } from "@/lib/supabase/server";

// Texts from your own Redial line (the SMS page). You can text from lines you
// own, or that were shared with you with "send and read texts". RLS checks
// the same rule (private.can_text_line). Numbers that replied STOP are
// refused until they text START. Each text segment counts against the line
// owner's texts (plan, free texts, then packs); sending pauses at zero.

type Result = { ok?: string; error?: string; sent?: number; outOfTexts?: boolean };

async function textableLine(lineId: string) {
  const lines = await myLines();
  return lines.find((l) => l.id === lineId && (l.access.owner || l.access.capabilities.includes("send_texts"))) ?? null;
}

const OUT = "You're out of texts for now. Buy a text pack or add a monthly text plan to keep sending.";

export async function sendLineText(input: { lineId: string; to: string[]; body: string }): Promise<Result> {
  await requireUser();
  const line = await textableLine(String(input.lineId ?? ""));
  if (!line) return { error: "You can't text from that line." };
  const body = String(input.body ?? "").trim().slice(0, 1600);
  if (!body) return { error: "Write a message." };
  const numbers = [...new Set((Array.isArray(input.to) ? input.to : []).map((n) => e164(String(n))).filter((n): n is string => Boolean(n)))].slice(0, 50);
  if (!numbers.length) return { error: "Add who it goes to." };

  const supabase = await createClient();
  const segments = segmentsOf(body);
  const usage = await lineSmsUsage(supabase, line.id);
  if (usage && usage.remaining < segments * numbers.length) {
    return usage.remaining < segments ? { error: OUT, outOfTexts: true }
      : { error: `That needs ${segments * numbers.length} texts and ${usage.remaining} are left. Send to fewer people, or buy a text pack.`, outOfTexts: true };
  }
  const { data: stopped } = await supabase.rpc("line_opt_outs", { p_line: line.id, p_numbers: numbers });
  const blocked = new Set((stopped ?? []) as string[]);
  let sent = 0;
  const failed: string[] = [];
  for (const to of numbers) {
    if (blocked.has(to)) { failed.push(`${to} replied STOP`); continue; }
    const res = await twilioSms(to, body, line.number);
    const row = {
      direction: "outbound", from_number: line.number, to_number: to, body, line_id: line.id,
      status: res.ok ? res.status ?? "sent" : "failed", error: res.ok ? null : (res.error ?? "Not sent").slice(0, 500), twilio_sid: res.sid ?? null,
    };
    const ins = await supabase.from("phone_messages").insert({ ...row, segments });
    if (ins.error && /segments|schema cache/i.test(ins.error.message)) await supabase.from("phone_messages").insert(row);
    if (res.ok) sent++; else failed.push(`${to}: ${res.error ?? "not sent"}`);
  }
  revalidatePath("/sms");
  if (failed.length) return { error: `Sent to ${sent}. Not sent: ${failed.join("; ")}`, sent };
  return { ok: sent === 1 ? "Sent." : `Sent to ${sent} people.`, sent };
}

// Send later: checked again when it goes out (opt-outs, texts left).
export async function scheduleLineText(input: { lineId: string; to: string[]; body: string; sendAt: string }): Promise<Result> {
  const user = await requireUser();
  const line = await textableLine(String(input.lineId ?? ""));
  if (!line) return { error: "You can't text from that line." };
  const body = String(input.body ?? "").trim().slice(0, 1600);
  if (!body) return { error: "Write a message." };
  const numbers = [...new Set((Array.isArray(input.to) ? input.to : []).map((n) => e164(String(n))).filter((n): n is string => Boolean(n)))].slice(0, 50);
  if (!numbers.length) return { error: "Add who it goes to." };
  const at = new Date(String(input.sendAt ?? ""));
  if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) return { error: "Pick a time at least a minute from now." };
  if (at.getTime() > Date.now() + 180 * 24 * 3600 * 1000) return { error: "Pick a time within 6 months." };
  const supabase = await createClient();
  const { error } = await supabase.from("line_scheduled_texts").insert({ line_id: line.id, to_numbers: numbers, body, send_at: at.toISOString() });
  if (error) return { error: /line_scheduled_texts|schema cache/i.test(error.message) ? "Scheduled texts need the SMS billing database update first." : error.message };
  void user;
  revalidatePath("/sms");
  return { ok: `Scheduled for ${at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` };
}

export async function cancelScheduledText(id: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error, count } = await supabase.from("line_scheduled_texts").update({ status: "canceled" }, { count: "exact" }).eq("id", id).eq("status", "scheduled");
  if (error) return { error: error.message };
  if (!count) return { error: "It already went out or was canceled." };
  revalidatePath("/sms");
  return { ok: "Canceled." };
}

export async function markLineThreadRead(lineId: string, number: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("phone_messages").update({ read_at: new Date().toISOString() })
    .eq("line_id", lineId).eq("direction", "inbound").eq("from_number", number).is("read_at", null);
  revalidatePath("/sms");
  return { ok: "Read." };
}
