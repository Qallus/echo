"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { EngagementType } from "./messages";

// Inbox writes. Each one calls a database function that checks which side
// you're on, masks contact details and notifies the other side.

type Result<T = true> = { ok?: T; error?: string };

function friendly(e: { code?: string; message: string }): string {
  if (["22023", "54000", "42501"].includes(e.code ?? "") && !/permission denied|row-level/.test(e.message)) return e.message;
  if (e.code === "PGRST202") return "Messaging is being set up. Try again shortly.";
  return "Couldn't send that. Please try again.";
}

const refresh = (thread?: string) => {
  revalidatePath("/messages", "layout");
  revalidatePath("/hiring");
  revalidatePath("/agent-desk");
  if (thread) revalidatePath(`/messages/${thread}`);
};

export async function startLiveAgentThread(agentId: string, workspaceId: string, body: string): Promise<Result<string>> {
  if (!isUuid(agentId) || !isUuid(workspaceId)) return { error: "Choose who to message." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_agent_start_thread", { agent: agentId, ws: workspaceId, body: body.slice(0, 4000) });
  if (error) return { error: friendly(error) };
  refresh(data as string);
  return { ok: data as string };
}

export async function sendLiveAgentMessage(thread: string, body: string): Promise<Result> {
  if (!isUuid(thread)) return { error: "Conversation not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_send", { t: thread, body: body.slice(0, 4000) });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function markLiveAgentThreadRead(thread: string): Promise<void> {
  if (!isUuid(thread)) return;
  const supabase = await createClient();
  await supabase.rpc("live_agent_mark_read", { t: thread });
  revalidatePath("/messages", "layout");
}

export type OfferInput = {
  type: EngagementType; rate: string; hours: string; startsOn: string; endsOn: string; schedule: string; script: string; note: string; replaces?: string;
};

export async function sendLiveAgentOffer(thread: string, f: OfferInput): Promise<Result> {
  if (!isUuid(thread)) return { error: "Conversation not found." };
  const rate = Math.round(Number(f.rate.replace(/[$,\s]/g, "")) * 100);
  if (!Number.isFinite(rate) || rate < 10) return { error: "Set the rate." };
  const hours = f.hours.trim() ? Number(f.hours) : null;
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 744)) return { error: "Hours must be a number." };
  const date = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
  if (f.startsOn && f.endsOn && date(f.endsOn) < date(f.startsOn)) return { error: "The end date must be after the start date." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_offer", {
    t: thread,
    p: {
      type: f.type, rate_cents: rate, hours: hours ?? "", starts_on: date(f.startsOn), ends_on: date(f.endsOn), schedule: f.schedule.slice(0, 300),
      script: f.script.slice(0, 4000), note: f.note.slice(0, 500), replaces: f.replaces && isUuid(f.replaces) ? f.replaces : "",
    },
  });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function respondToLiveAgentOffer(engagement: string, action: "accept" | "decline" | "withdraw" | "cancel" | "complete", thread?: string): Promise<Result> {
  if (!isUuid(engagement)) return { error: "Offer not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_respond", { engagement, action });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function routeLiveAgentCalls(engagement: string, line: string | null, thread?: string): Promise<Result> {
  if (!isUuid(engagement) || (line !== null && !isUuid(line))) return { error: "Choose a line." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_route", { engagement, line });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function reviewLiveAgentWork(engagement: string, stars: number, body: string, thread?: string): Promise<Result> {
  if (!isUuid(engagement)) return { error: "Booking not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_review", { engagement, stars: Math.round(stars), body: body.slice(0, 1000) });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function blockLiveAgentThread(thread: string): Promise<Result> {
  if (!isUuid(thread)) return { error: "Conversation not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_block", { t: thread });
  if (error) return { error: friendly(error) };
  refresh(thread);
  return { ok: true };
}

export async function reportLiveAgentThread(thread: string, reason: string, details: string): Promise<Result> {
  if (!isUuid(thread)) return { error: "Conversation not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("live_agent_report", { t: thread, reason, details: details.slice(0, 2000) });
  if (error) return { error: friendly(error) };
  return { ok: true };
}
