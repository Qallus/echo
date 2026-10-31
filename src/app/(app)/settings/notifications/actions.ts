"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { codeHash, emailHtml, sendEmail, sendSms, toE164 } from "@/lib/notify/senders";
import { CHANNELS, NOTIFICATION_TYPES, type Channel } from "@/lib/notify/types";

export type Result = { ok?: string; error?: string; channelId?: string };

const PATH = "/settings/notifications";

// Add an email address or phone number, then send it a code.
export async function addChannel(kind: "email" | "sms", raw: string): Promise<Result> {
  const user = await requireUser();
  let address = raw.trim();
  if (kind === "email") {
    address = address.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { error: "Enter a valid email address." };
    if (address === user.email.toLowerCase()) return { error: "That's your account email. Echo already uses it." };
  } else {
    const e164 = toE164(address);
    if (!e164) return { error: "Enter a full phone number, e.g. +1 555 123 4567." };
    address = e164;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("notification_channels")
    .insert({ user_id: user.id, kind, address }).select("id").single();
  if (error) return { error: error.code === "23505" ? "You've already added that." : error.message };
  const sent = await sendCode(data.id);
  revalidatePath(PATH);
  return sent.error ? { ...sent, channelId: data.id } : { ok: sent.ok, channelId: data.id };
}

export async function sendCode(channelId: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data: c } = await supabase.from("notification_channels").select("id, kind, address, verified_at").eq("id", channelId).maybeSingle();
  if (!c || c.kind === "push") return { error: "Channel not found." };
  if (c.verified_at) return { ok: "Already verified." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: allowed, error } = await supabase.rpc("channel_code_issue", { channel: c.id, hash: codeHash(c.id, code) });
  if (error) return { error: error.message };
  if (!allowed) return { error: "Too many codes sent. Try again in an hour." };

  const res = c.kind === "email"
    ? await sendEmail(c.address, `Your Echo code: ${code}`,
        emailHtml({ title: `Your verification code is ${code}`, body: "Enter it in Echo to get notifications at this address. It expires in 15 minutes." }),
        `Your Echo verification code is ${code}. It expires in 15 minutes.`)
    : await sendSms(c.address, `Your Echo code is ${code}. Msg & data rates may apply. Reply STOP to opt out.`);
  if (!res.ok) return { error: `Couldn't send the code: ${res.error}` };
  return { ok: `Code sent to ${c.address}.` };
}

export async function verifyCode(channelId: string, code: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("channel_code_verify", { channel: channelId, code: code.replace(/\D/g, "") });
  if (error) return { error: error.message };
  const messages: Record<string, Result> = {
    verified: { ok: "Verified." },
    wrong: { error: "That code isn't right." },
    expired: { error: "That code expired. Send a new one." },
    locked: { error: "Too many tries. Send a new code." },
    not_found: { error: "Channel not found." },
  };
  revalidatePath(PATH);
  return messages[data as string] ?? { error: "Couldn't verify." };
}

export async function removeChannel(channelId: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_channels").delete().eq("id", channelId);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: "Removed." };
}

// Push: one subscription per browser/device. Re-subscribing replaces it.
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string): Promise<Result> {
  const user = await requireUser();
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "That push subscription isn't valid." };
  const supabase = await createClient();
  await supabase.from("notification_channels").delete().eq("kind", "push").eq("address", sub.endpoint);
  const { error } = await supabase.from("notification_channels").insert({
    user_id: user.id, kind: "push", address: sub.endpoint, label: label.slice(0, 100), push_subscription: sub,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: "Push notifications are on for this device." };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("notification_channels").delete().eq("kind", "push").eq("address", endpoint);
  revalidatePath(PATH);
  return { ok: "Push notifications are off for this device." };
}

export async function setPreference(type: string, channel: Channel, on: boolean): Promise<Result> {
  const user = await requireUser();
  if (!NOTIFICATION_TYPES.some((t) => t.type === type) || !CHANNELS.some((c) => c.key === channel)) return { error: "Unknown setting." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("notification_preferences").select("*").eq("user_id", user.id).eq("type", type).maybeSingle();
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: user.id, type, in_app: row?.in_app ?? true, email: row?.email ?? true, sms: row?.sms ?? false, push: row?.push ?? false,
    [channel]: on,
  });
  if (error) return { error: error.message };
  return {};
}

export async function setQuietHours(start: string, end: string): Promise<Result> {
  const user = await requireUser();
  const valid = (t: string) => t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!valid(start) || !valid(end)) return { error: "Use times like 22:00." };
  if (!!start !== !!end) return { error: "Set both a start and an end, or neither." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ quiet_start: start || null, quiet_end: end || null }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: start ? `Quiet from ${start} to ${end} (your time zone).` : "Quiet hours off." };
}

export async function sendTest(): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_test_notification");
  if (error) return { error: error.message };
  return { ok: "Test sent. It goes to the bell and every channel you've set up." };
}
