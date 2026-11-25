"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { twilioSms, e164 } from "@/lib/comms/twilio";
import { myLines } from "@/lib/redial/data";
import { createClient } from "@/lib/supabase/server";

// Texts from your own Redial line (the SMS page). You can text from lines you
// own, or that were shared with you with "send and read texts". RLS checks
// the same rule (private.can_text_line). Numbers that replied STOP are
// refused until they text START.

type Result = { ok?: string; error?: string; sent?: number };

async function textableLine(lineId: string) {
  const lines = await myLines();
  return lines.find((l) => l.id === lineId && (l.access.owner || l.access.capabilities.includes("send_texts"))) ?? null;
}

export async function sendLineText(input: { lineId: string; to: string[]; body: string }): Promise<Result> {
  await requireUser();
  const line = await textableLine(String(input.lineId ?? ""));
  if (!line) return { error: "You can't text from that line." };
  const body = String(input.body ?? "").trim().slice(0, 1600);
  if (!body) return { error: "Write a message." };
  const numbers = [...new Set((Array.isArray(input.to) ? input.to : []).map((n) => e164(String(n))).filter((n): n is string => Boolean(n)))].slice(0, 50);
  if (!numbers.length) return { error: "Add who it goes to." };

  const supabase = await createClient();
  const { data: stopped } = await supabase.rpc("line_opt_outs", { p_line: line.id, p_numbers: numbers });
  const blocked = new Set((stopped ?? []) as string[]);
  let sent = 0;
  const failed: string[] = [];
  for (const to of numbers) {
    if (blocked.has(to)) { failed.push(`${to} replied STOP`); continue; }
    const res = await twilioSms(to, body, line.number);
    await supabase.from("phone_messages").insert({
      direction: "outbound", from_number: line.number, to_number: to, body, line_id: line.id,
      status: res.ok ? res.status ?? "sent" : "failed", error: res.ok ? null : (res.error ?? "Not sent").slice(0, 500), twilio_sid: res.sid ?? null,
    });
    if (res.ok) sent++; else failed.push(`${to}: ${res.error ?? "not sent"}`);
  }
  revalidatePath("/sms");
  if (failed.length) return { error: `Sent to ${sent}. Not sent: ${failed.join("; ")}`, sent };
  return { ok: sent === 1 ? "Sent." : `Sent to ${sent} people.`, sent };
}

export async function markLineThreadRead(lineId: string, number: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("phone_messages").update({ read_at: new Date().toISOString() })
    .eq("line_id", lineId).eq("direction", "inbound").eq("from_number", number).is("read_at", null);
  revalidatePath("/sms");
  return { ok: "Read." };
}
