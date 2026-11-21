"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { processVisibilityRun, readVisibility, startVisibilityRun, type VisibilitySettings } from "@/lib/analytics/ai-visibility";
import { isChannel } from "@/lib/analytics/channels";
import { syncSearchConsole } from "@/lib/analytics/search-console";
import { uuids, type Result } from "@/lib/crm/validate";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Admin -> Analytics: ad spend and social numbers you enter, short links,
// the AI visibility check, and Search Console sync. Changing settings or
// running jobs needs settings.manage; every change is audited.

const refresh = () => revalidatePath("/admin/analytics");
const int = (v: unknown) => { const n = Number(String(v ?? "").replace(/[,\s]/g, "")); return String(v ?? "").trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
const monthOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}/.test(v) ? `${v.slice(0, 7)}-01` : null);

export async function saveSpend(f: Record<string, string>): Promise<Result> {
  await requireStaff("settings.manage");
  const month = monthOf(f.month);
  const amount = Number(String(f.amount ?? "").replace(/[$,\s]/g, ""));
  if (!month) return { error: "Pick a month." };
  if (!isChannel(f.channel) || f.channel === "direct") return { error: "Pick a channel." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Enter the amount in dollars." };
  const supabase = await createClient();
  const { error } = await supabase.from("marketing_spend").insert({
    month, channel: f.channel, source: f.source?.trim().slice(0, 100) || null, amount_cents: Math.round(amount * 100),
    clicks: int(f.clicks), impressions: int(f.impressions), conversions: int(f.conversions), notes: f.notes?.trim().slice(0, 500) || null,
  });
  if (error) return { error: error.message };
  await adminAudit(supabase, "analytics.spend.add", undefined, { month, channel: f.channel, amount });
  refresh();
  return { ok: "Saved." };
}

export async function deleteSpend(id: string): Promise<Result> {
  await requireStaff("settings.manage");
  const [one] = uuids([id]);
  if (!one) return { error: "Not found." };
  const supabase = await createClient();
  await supabase.from("marketing_spend").delete().eq("id", one);
  await adminAudit(supabase, "analytics.spend.delete", { type: "marketing_spend", id: one });
  refresh();
  return { ok: "Deleted." };
}

const NETWORKS = ["linkedin", "facebook", "instagram", "x", "youtube", "tiktok", "nextdoor", "google_business", "other"];

export async function saveSocial(f: Record<string, string>): Promise<Result> {
  await requireStaff("settings.manage");
  const month = monthOf(f.month);
  if (!month) return { error: "Pick a month." };
  if (!NETWORKS.includes(f.network)) return { error: "Pick a network." };
  const supabase = await createClient();
  const { error } = await supabase.from("social_stats").upsert({
    month, network: f.network, followers: int(f.followers), reach: int(f.reach), engagements: int(f.engagements),
    posts: int(f.posts), clicks: int(f.clicks), calls: int(f.calls), notes: f.notes?.trim().slice(0, 500) || null,
  }, { onConflict: "month,network" });
  if (error) return { error: error.message };
  await adminAudit(supabase, "analytics.social.save", undefined, { month, network: f.network });
  refresh();
  return { ok: "Saved." };
}

export async function deleteSocial(id: string): Promise<Result> {
  await requireStaff("settings.manage");
  const [one] = uuids([id]);
  if (!one) return { error: "Not found." };
  const supabase = await createClient();
  await supabase.from("social_stats").delete().eq("id", one);
  refresh();
  return { ok: "Deleted." };
}

// redial.si/l/<code>: a short link that counts clicks (for texts and posts).
export async function createShortLink(url: string, channel: string, campaign: string | null): Promise<Result & { url?: string }> {
  await requireStaff("comms.manage");
  if (!/^https:\/\/\S+$/.test(url) || url.length > 1000) return { error: "Use a full https:// link." };
  const supabase = await createClient();
  for (let i = 0; i < 3; i++) {
    const code = randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
    if (code.length < 6) continue;
    const { error } = await supabase.from("short_links").insert({ code, url, channel: ["sms", "email", "social", "card", "partner", "ads"].includes(channel) ? channel : "campaign", campaign: campaign?.slice(0, 120) || null });
    if (!error) return { ok: "Created.", url: `${await siteOrigin()}/l/${code}` };
    if (!/duplicate/i.test(error.message)) return { error: error.message };
  }
  return { error: "Couldn't make a short link. Try again." };
}

export async function saveVisibilitySettings(input: VisibilitySettings): Promise<Result> {
  await requireStaff("settings.manage");
  const value = readVisibility(input);
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "ai_visibility", value });
  if (error) return { error: error.message };
  await adminAudit(supabase, "analytics.ai_visibility.settings", { type: "setting", id: "ai_visibility" }, { questions: value.questions.length, competitors: value.competitors.length });
  refresh();
  return { ok: "Saved." };
}

export async function runVisibilityNow(): Promise<Result & { runId?: string }> {
  await requireStaff("settings.manage");
  const supabase = await createClient();
  const r = await startVisibilityRun(supabase);
  if (r.error || !r.runId) return { error: r.error ?? "Couldn't start." };
  await adminAudit(supabase, "analytics.ai_visibility.run", { type: "ai_visibility_run", id: r.runId });
  return { ok: "Started.", runId: r.runId };
}

export async function stepVisibilityRun(runId: string) {
  await requireStaff("settings.manage");
  const [one] = uuids([runId]);
  if (!one) return { done: 0, total: 0, finished: true };
  const p = await processVisibilityRun(await createClient(), one, 3);
  if (p.finished) refresh();
  return p;
}

export async function syncSearchConsoleNow(): Promise<Result> {
  await requireStaff("settings.manage");
  const supabase = await createClient();
  const r = await syncSearchConsole(supabase, { force: true });
  if (r.error) return { error: r.error };
  await adminAudit(supabase, "analytics.search_console.sync", undefined, { rows: r.rows ?? 0 });
  refresh();
  return { ok: `Synced ${r.rows ?? 0} rows from Search Console.` };
}
