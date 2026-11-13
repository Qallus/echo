"use server";

import { revalidatePath } from "next/cache";
import { geocode } from "@/lib/crm/geocode";
import { getUser } from "@/lib/data";
import { BUCKET as STUDIO_BUCKET } from "@/lib/studio/data";
import { createClient } from "@/lib/supabase/server";
import { myLiveAgent, profileGaps } from "./agent-data";
import { CLIP_MAX_S, COMMON_LANGUAGES, TIME_ZONES, US_STATES } from "./setup";
import { EQUIPMENT, WEEKDAYS, WORKSPACE, type Weekday } from "./types";

// Writes for a person's own Live Agent profile. Everything runs as them, so
// RLS and column grants decide what they can change; status changes are
// limited by a database trigger (draft -> review, live <-> paused).

type Result = { ok?: true; error?: string };
const MEDIA = "live-agent-media";

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (x: unknown, max: number, len = 40) =>
  [...new Set((Array.isArray(x) ? x : []).map((v) => clean(v, len)).filter(Boolean))].slice(0, max);

function refresh(handle?: string) {
  revalidatePath("/agent-desk", "layout");
  revalidatePath("/live-agents");
  if (handle) revalidatePath(`/live-agents/${handle}`);
}

function dbError(e: { code?: string; message: string } | null, fallback = "Couldn't save that. Please try again."): string | undefined {
  if (!e) return undefined;
  if (["22023", "42501"].includes(e.code ?? "") && !e.message.includes("row-level security")) return e.message;
  if (e.code === "23514") return "One of those values is outside what's allowed. Check the numbers and lengths.";
  return fallback;
}

async function me() {
  const user = await getUser();
  if (!user) return null;
  return { user, supabase: await createClient(), agent: await myLiveAgent() };
}

const nextStep = (current: number, done: number) => Math.min(8, Math.max(current, done + 1));

// A spot about 1–2.5 km from the city's centre, so the map shows an area,
// never where someone lives.
function fuzz(p: { lat: number; lng: number }) {
  const km = 1 + Math.random() * 1.5, angle = Math.random() * Math.PI * 2;
  return { lat: +(p.lat + (km / 111) * Math.cos(angle)).toFixed(5), lng: +(p.lng + (km / (111 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(angle)).toFixed(5) };
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const RESERVED = new Set(["how-it-works", "help", "become", "new", "search", "map"]);

// Step 1: name, headline, where, time zone. Creates the profile.
export async function saveAgentBasics(f: { firstName: string; lastName: string; headline: string; city: string; region: string; timeZone: string }): Promise<Result> {
  const ctx = await me();
  if (!ctx) return { error: "Sign in first." };
  const first = clean(f.firstName, 30), last = clean(f.lastName, 30);
  const headline = clean(f.headline, 90), city = clean(f.city, 60), region = clean(f.region, 2).toUpperCase();
  if (first.length < 2 || !last) return { error: "Enter your first and last name. Businesses see your first name and last initial." };
  if (headline.length < 4) return { error: "Write a short headline, for example \"Warm, organized front desk for dental offices\"." };
  if (city.length < 2 || !US_STATES.includes(region)) return { error: "Enter your city and choose your state." };
  const timeZone = TIME_ZONES.some((t) => t.value === f.timeZone) ? f.timeZone : "America/Phoenix";
  const displayName = `${first[0].toUpperCase()}${first.slice(1)} ${last[0].toUpperCase()}.`;
  const { agent, supabase, user } = ctx;

  const moved = !agent || agent.city !== city || agent.region !== region;
  const spot = moved ? await geocode(`${city}, ${region}, USA`) : null;
  const geo = spot ? fuzz(spot) : moved ? { lat: null, lng: null } : {};
  const fields = {
    display_name: displayName, headline, city, region, time_zone: timeZone,
    ...("lat" in geo ? { geo_lat: geo.lat, geo_lng: geo.lng } : {}),
  };

  if (agent) {
    const { error } = await supabase.from("live_agents").update({ ...fields, setup_step: nextStep(agent.setupStep, 1) }).eq("id", agent.id);
    if (error) return { error: dbError(error) };
    refresh(agent.handle);
    return { ok: true };
  }

  const base = slug(`${first}-${last[0]}`).slice(0, 34) || "agent";
  for (let i = 0; i < 6; i++) {
    const handle = i === 0 && !RESERVED.has(base) && base.length >= 3 ? base : `${base}-${Math.floor(10 + Math.random() * 90)}`;
    const { error } = await supabase.from("live_agents").insert({ ...fields, user_id: user.id, handle });
    if (!error) {
      await supabase.from("live_agents").update({ setup_step: 2 }).eq("user_id", user.id);
      refresh();
      return { ok: true };
    }
    if (error.code !== "23505") return { error: dbError(error) };
    if (error.message.includes("user_id")) return { error: "You already have a profile. Refresh the page." };
  }
  return { error: "Couldn't create your profile. Please try again." };
}

// Step 2: the photo was uploaded from the browser to <uid>/...; save it.
export async function setAgentPhoto(path: string | null): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const { agent, supabase, user } = ctx;
  if (path !== null && (!path.startsWith(`${user.id}/`) || path.length > 300 || path.includes(".."))) return { error: "That upload didn't work. Try again." };
  const { error } = await supabase.from("live_agents").update({ avatar_url: path, setup_step: nextStep(agent.setupStep, path ? 2 : 1) }).eq("id", agent.id);
  if (error) return { error: dbError(error) };
  if (agent.avatarPath && agent.avatarPath !== path && agent.avatarPath.startsWith(`${user.id}/`)) {
    await supabase.storage.from(MEDIA).remove([agent.avatarPath]);
  }
  refresh(agent.handle);
  return { ok: true };
}

export async function markAgentStep(step: number): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  if (ctx.agent.setupStep > step) return { ok: true };
  const { error } = await ctx.supabase.from("live_agents").update({ setup_step: nextStep(ctx.agent.setupStep, step) }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

// Step 3: years, bio, past roles, industries.
export async function saveAgentExperience(f: { years: number; bio: string; experience: { title: string; detail: string }[]; industries: string[] }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const years = Math.round(Number(f.years));
  if (!Number.isFinite(years) || years < 0 || years > 60) return { error: "Enter your years of experience (0–60)." };
  const bio = typeof f.bio === "string" ? f.bio.trim().slice(0, 600) : "";
  if (bio.length < 40) return { error: "Write a short bio, at least 40 characters, about the calls you're great at." };
  if (/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|@|https?:\/\/|www\./i.test(bio)) return { error: "Leave phone numbers, emails and links out of your bio. Businesses reach you through Redial." };
  const experience = (Array.isArray(f.experience) ? f.experience : [])
    .map((e) => ({ title: clean(e?.title, 80), detail: clean(e?.detail, 120) }))
    .filter((e) => e.title).slice(0, 5)
    .map((e) => (e.detail ? e : { title: e.title }));
  const industries = list(f.industries, 8, 30);
  const { error } = await ctx.supabase.from("live_agents").update({ years_experience: years, bio, experience, industries, setup_step: nextStep(ctx.agent.setupStep, 3) }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Step 4: skills (from the catalog) and languages.
export async function saveAgentSkills(f: { skills: string[]; languages: string[] }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const { data: catalog } = await ctx.supabase.from("live_agent_skills").select("slug");
  const known = new Set((catalog ?? []).map((s) => s.slug as string));
  const skills = list(f.skills, 16).filter((s) => known.has(s));
  if (skills.length < 2) return { error: "Pick at least 2 skills." };
  const languages = list(f.languages, 8, 30).map((l) => COMMON_LANGUAGES.find((c) => c.toLowerCase() === l.toLowerCase()) ?? l[0].toUpperCase() + l.slice(1));
  if (!languages.length) return { error: "Add at least one language you take calls in." };
  const { error } = await ctx.supabase.from("live_agents").update({ skills, languages, setup_step: nextStep(ctx.agent.setupStep, 4) }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Step 5: equipment and workspace (slugs from the lists in types.ts).
export async function saveAgentWorkspace(f: { equipment: string[]; workspace: string[] }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const equipment = list(f.equipment, 16).filter((s) => EQUIPMENT.some((e) => e.slug === s));
  const workspace = list(f.workspace, 10).filter((s) => WORKSPACE.some((w) => w.slug === s));
  if (!equipment.some((s) => ["desktop", "laptop", "tablet"].includes(s))) return { error: "Choose the computer or tablet you take calls on." };
  if (!workspace.length) return { error: "Tell businesses where you work from." };
  const { error } = await ctx.supabase.from("live_agents").update({ equipment, workspace, setup_step: nextStep(ctx.agent.setupStep, 5) }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Step 6: a clip uploaded from the browser to <uid>/clips/...
export async function addVoiceClip(f: { path: string; title: string; transcript: string; duration: number }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const { agent, supabase, user } = ctx;
  if (!f.path.startsWith(`${user.id}/clips/`) || f.path.includes("..") || f.path.length > 300) return { error: "That upload didn't work. Try again." };
  const duration = Math.round(Number(f.duration) * 10) / 10;
  if (!(duration > 0) || duration > CLIP_MAX_S + 1) {
    await supabase.storage.from(MEDIA).remove([f.path]);
    return { error: `Clips can be up to ${CLIP_MAX_S} seconds.` };
  }
  const { error } = await supabase.from("live_agent_voice_samples").insert({
    agent_id: agent.id, title: clean(f.title, 60) || "Voice clip", transcript: clean(f.transcript, 600) || null, storage_path: f.path,
    duration_s: duration, featured: agent.samples.length === 0, sort: agent.samples.length + 1,
  });
  if (error) {
    await supabase.storage.from(MEDIA).remove([f.path]);
    return { error: dbError(error) };
  }
  refresh(agent.handle);
  return { ok: true };
}

// Step 6: use a recording made in the Recording Studio (copied, so the
// private Studio file is never made public).
export async function importStudioClip(studioId: string, title: string): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const { agent, supabase, user } = ctx;
  if (agent.samples.length >= 3) return { error: "You can have up to 3 voice clips. Delete one first." };
  const { data: row } = await supabase.from("studio_audio").select("id, name, storage_path, mime, size_bytes, duration_seconds").eq("id", studioId).maybeSingle();
  if (!row) return { error: "That recording wasn't found." };
  const duration = Number(row.duration_seconds ?? 0);
  if (!duration || duration > CLIP_MAX_S + 1) return { error: `Pick a recording of ${CLIP_MAX_S} seconds or less.` };
  if (Number(row.size_bytes) > 5 * 1024 * 1024) return { error: "That recording is over 5 MB." };
  const { data: blob, error: dl } = await supabase.storage.from(STUDIO_BUCKET).download(row.storage_path);
  if (dl || !blob) return { error: "Couldn't read that recording." };
  const ext = row.storage_path.split(".").pop()?.slice(0, 5) ?? "wav";
  const path = `${user.id}/clips/${Date.now()}.${ext}`;
  const { error: up } = await supabase.storage.from(MEDIA).upload(path, blob, { contentType: row.mime });
  if (up) return { error: "Couldn't copy that recording. Try again." };
  return addVoiceClip({ path, title: clean(title, 60) || row.name, transcript: "", duration });
}

export async function updateVoiceClip(id: string, f: { title?: string; transcript?: string; featured?: boolean }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent?.samples.some((s) => s.id === id)) return { error: "Clip not found." };
  const { agent, supabase } = ctx;
  const patch: Record<string, unknown> = {};
  if (f.title !== undefined) patch.title = clean(f.title, 60) || "Voice clip";
  if (f.transcript !== undefined) patch.transcript = clean(f.transcript, 600) || null;
  if (f.featured) {
    await supabase.from("live_agent_voice_samples").update({ featured: false }).eq("agent_id", agent.id).neq("id", id);
    patch.featured = true;
  }
  const { error } = await supabase.from("live_agent_voice_samples").update(patch).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh(agent.handle);
  return { ok: true };
}

export async function deleteVoiceClip(id: string): Promise<Result> {
  const ctx = await me();
  const clip = ctx?.agent?.samples.find((s) => s.id === id);
  if (!ctx?.agent || !clip) return { error: "Clip not found." };
  const { data } = await ctx.supabase.from("live_agent_voice_samples").select("storage_path, featured").eq("id", id).maybeSingle();
  const { error } = await ctx.supabase.from("live_agent_voice_samples").delete().eq("id", id);
  if (error) return { error: dbError(error) };
  if (data?.storage_path?.startsWith(`${ctx.user.id}/`)) await ctx.supabase.storage.from(MEDIA).remove([data.storage_path]);
  const rest = ctx.agent.samples.filter((s) => s.id !== id);
  if (data?.featured && rest[0]) await ctx.supabase.from("live_agent_voice_samples").update({ featured: true }).eq("id", rest[0].id);
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Step 7: rates (in dollars from the form) and weekly hours.
export async function saveAgentRates(f: { perMinute: string; hourly: string; retainer: string; retainerHours: string; availability: Partial<Record<Weekday, [string, string]>> }): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  const cents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[$,\s]/g, "")) * 100));
  const perMinute = cents(f.perMinute), hourly = cents(f.hourly), retainer = cents(f.retainer);
  const hours = f.retainerHours.trim() === "" ? null : Math.round(Number(f.retainerHours));
  if ([perMinute, hourly, retainer, hours].some((v) => v !== null && !Number.isFinite(v))) return { error: "Rates must be numbers." };
  if (perMinute == null && hourly == null) return { error: "Set a per-minute rate, an hourly rate, or both." };
  if (perMinute != null && (perMinute < 10 || perMinute > 1000)) return { error: "Per-minute rates can be $0.10 to $10.00." };
  if (hourly != null && (hourly < 1000 || hourly > 20000)) return { error: "Hourly rates can be $10 to $200." };
  if ((retainer == null) !== (hours == null)) return { error: "For a monthly plan, set both the price and the hours included." };
  if (retainer != null && (retainer < 10000 || retainer > 2000000)) return { error: "Monthly plans can be $100 to $20,000." };
  if (hours != null && (hours < 5 || hours > 200)) return { error: "Monthly plans can include 5 to 200 hours." };

  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const availability: Partial<Record<Weekday, [string, string]>> = {};
  for (const { key, short } of WEEKDAYS) {
    const w = f.availability?.[key];
    if (!w) continue;
    const [from, to] = w;
    if (!time.test(from) || !(time.test(to) || to === "23:59") || from >= to) return { error: `Check your hours for ${short}: the end must be after the start.` };
    availability[key] = [from, to];
  }
  if (!Object.keys(availability).length) return { error: "Choose at least one day you're available." };
  const { error } = await ctx.supabase.from("live_agents").update({
    per_minute_cents: perMinute, hourly_cents: hourly, retainer_cents: retainer, retainer_hours: hours, availability, setup_step: nextStep(ctx.agent.setupStep, 7),
  }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Step 8: send for review (draft -> pending). Staff are notified by the database.
export async function submitAgentProfile(): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Start with the basics first." };
  if (ctx.agent.status !== "draft") return { error: "Your profile has already been sent." };
  const gaps = profileGaps(ctx.agent);
  if (gaps.length) return { error: `Almost there: ${gaps.map((g) => g.label.toLowerCase()).join(", ")}.` };
  const { error } = await ctx.supabase.from("live_agents").update({ status: "pending", setup_step: 8 }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: true };
}

// pending -> draft (to keep editing), live <-> paused, Available now.
export async function setAgentListing(action: "withdraw" | "pause" | "resume"): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "No profile yet." };
  const to = action === "withdraw" ? "draft" : action === "pause" ? "paused" : "live";
  const { error } = await ctx.supabase.from("live_agents").update({ status: to }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

export async function setAvailableNow(on: boolean): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "No profile yet." };
  if (on && ctx.agent.status !== "live") return { error: "You can go available once your profile is live." };
  const { error } = await ctx.supabase.from("live_agents").update({ available_now: on }).eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Removes the profile, its clips and its files.
export async function deleteAgentProfile(): Promise<Result> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "No profile yet." };
  const { supabase, user } = ctx;
  const { error } = await supabase.from("live_agents").delete().eq("id", ctx.agent.id);
  if (error) return { error: dbError(error) };
  const [{ data: top }, { data: clips }] = await Promise.all([
    supabase.storage.from(MEDIA).list(user.id, { limit: 100 }), supabase.storage.from(MEDIA).list(`${user.id}/clips`, { limit: 100 }),
  ]);
  const paths = [...(top ?? []).filter((o) => o.id).map((o) => `${user.id}/${o.name}`), ...(clips ?? []).map((o) => `${user.id}/clips/${o.name}`)];
  if (paths.length) await supabase.storage.from(MEDIA).remove(paths);
  refresh(ctx.agent.handle);
  return { ok: true };
}

// Agent Desk phone: a browser calling token so transfers ring this agent.
// Incoming only; the identity is tied to the signed-in agent.
export async function agentDeskToken(): Promise<{ token?: string; error?: string }> {
  const ctx = await me();
  if (!ctx?.agent) return { error: "Create your Live Agent profile first." };
  if (ctx.agent.status !== "live") return { error: "Your phone turns on once your profile is live." };
  const { voiceToken } = await import("@/lib/comms/twilio");
  const { liveAgentIdentity } = await import("./handoff");
  const token = await voiceToken(liveAgentIdentity(ctx.user.id), { incoming: true });
  return token ? { token } : { error: "Calling isn't set up yet (the Twilio API key or TwiML App is missing)." };
}
