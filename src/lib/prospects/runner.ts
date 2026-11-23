import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { twilioLookupDetail } from "@/lib/comms/twilio";
import { mapCarrier } from "./carriers";
import { scoreProspect } from "./score";
import { loadProspecting, lookupCost, type ProspectingSettings } from "./settings";

// Twilio lookup runs for Redial's prospect list.
// estimate -> start (confirmed) -> processChunk until done. The page drives
// the chunks so results fill in live; the cron job finishes any run left
// behind (tab closed). Numbers looked up within the cache window are reused
// for free. A run can't push this month's spend past the cap.

const CHUNK = 20; // numbers per call from the page
const PARALLEL = 5; // Twilio requests at once
const MAX_ATTEMPTS = 4;
const STALE_MS = 2 * 60_000; // a claimed number nobody finished gets retried

export type Estimate = {
  total: number; cached: number; toLookUp: number; estCents: number;
  monthSpentCents: number; capCents: number; overCap: boolean; settings: ProspectingSettings;
};

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

export async function monthSpent(db: SupabaseClient): Promise<number> {
  const { data } = await db.from("lookup_runs").select("actual_cost_cents, est_cost_cents, status").is("workspace_id", null).gte("created_at", monthStart());
  // Finished runs count what they cost; runs still going count their estimate.
  const lookups = (data ?? []).reduce((sum, r) => sum + Number(r.status === "done" || r.status === "cancelled" ? r.actual_cost_cents : Math.max(r.actual_cost_cents, r.est_cost_cents)), 0);
  // Google Places searches share the cap (table from migration 20261123130000).
  const { data: searches } = await db.from("places_searches").select("cost_cents").is("workspace_id", null).gte("created_at", monthStart());
  return lookups + (searches ?? []).reduce((sum, r) => sum + Number(r.cost_cents), 0);
}

// The numbers a run would cover: the chosen prospects, or every prospect not
// looked up yet. Do-not-contact numbers are never looked up.
async function phonesFor(db: SupabaseClient, ids: string[] | null): Promise<string[]> {
  let q = db.from("prospects").select("phone_e164").is("workspace_id", null).neq("status", "dnc").limit(5000);
  if (ids) q = q.in("id", ids.slice(0, 5000));
  const { data } = await q;
  return [...new Set((data ?? []).map((p) => p.phone_e164 as string))];
}

async function split(db: SupabaseClient, phones: string[], callerName: boolean, s: ProspectingSettings) {
  const since = Date.now() - s.cacheDays * 86400_000;
  const fresh = new Set<string>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data } = await db.from("phone_lookups").select("phone_e164, looked_up_at, caller_name, raw").in("phone_e164", phones.slice(i, i + 300));
    for (const l of data ?? []) {
      const hadCallerName = Boolean((l.raw as { caller_name?: unknown } | null)?.caller_name);
      if (Date.parse(l.looked_up_at) >= since && (!callerName || hadCallerName)) fresh.add(l.phone_e164);
    }
  }
  return { cached: phones.filter((p) => fresh.has(p)), toLookUp: phones.filter((p) => !fresh.has(p)) };
}

export async function estimate(db: SupabaseClient, ids: string[] | null, callerName: boolean): Promise<Estimate> {
  const settings = await loadProspecting(db);
  const phones = await phonesFor(db, ids);
  const { cached, toLookUp } = await split(db, phones, callerName, settings);
  const estCents = lookupCost(settings, toLookUp.length, callerName);
  const spent = await monthSpent(db);
  return {
    total: phones.length, cached: cached.length, toLookUp: toLookUp.length, estCents, monthSpentCents: spent,
    capCents: settings.monthlyCapCents, overCap: spent + estCents > settings.monthlyCapCents, settings,
  };
}

// Re-score every Redial prospect with these numbers from their cached lookup.
async function rescore(db: SupabaseClient, phones: string[]) {
  for (let i = 0; i < phones.length; i += 200) {
    const batch = phones.slice(i, i + 200);
    const [{ data: rows }, { data: lookups }] = await Promise.all([
      db.from("prospects").select("id, phone_e164, status, category, city, website").is("workspace_id", null).in("phone_e164", batch),
      db.from("phone_lookups").select("phone_e164, provider, confidence").in("phone_e164", batch),
    ]);
    const by = new Map((lookups ?? []).map((l) => [l.phone_e164, l]));
    for (const r of rows ?? []) {
      const l = by.get(r.phone_e164);
      const score = scoreProspect({ provider: l?.provider ?? null, confidence: l?.confidence ?? null, category: r.category, city: r.city, website: r.website, status: r.status });
      await db.from("prospects").update({ score }).eq("id", r.id);
    }
  }
}

export async function startRun(db: SupabaseClient, ids: string[] | null, callerName: boolean): Promise<{ runId?: string; error?: string; est?: Estimate }> {
  const est = await estimate(db, ids, callerName);
  if (!est.total) return { error: "No numbers to look up." };
  if (est.overCap) return { error: `That would pass this month's cap ($${(est.capCents / 100).toFixed(2)}). Pick fewer numbers or raise the cap in Settings.`, est };
  const phones = await phonesFor(db, ids);
  const { cached, toLookUp } = await split(db, phones, callerName, est.settings);
  const { data: run, error } = await db.from("lookup_runs").insert({
    total: toLookUp.length, skipped_cached: cached.length, include_caller_name: callerName,
    est_cost_cents: est.estCents, status: toLookUp.length ? "running" : "done", ...(toLookUp.length ? {} : { finished_at: new Date().toISOString() }),
  }).select("id").single();
  if (error || !run) return { error: error?.message ?? "Couldn't start the run." };
  for (let i = 0; i < toLookUp.length; i += 500) {
    const { error: e } = await db.from("lookup_run_items").insert(toLookUp.slice(i, i + 500).map((phone_e164) => ({ run_id: run.id, phone_e164 })));
    if (e) return { error: e.message };
  }
  if (cached.length) await rescore(db, cached);
  return { runId: run.id, est };
}

export type RunProgress = { total: number; processed: number; failed: number; costCents: number; done: boolean; handled?: number };

async function progress(db: SupabaseClient, runId: string): Promise<RunProgress> {
  const { data } = await db.from("lookup_runs").select("total, processed, failed, actual_cost_cents, status").eq("id", runId).maybeSingle();
  return { total: data?.total ?? 0, processed: data?.processed ?? 0, failed: data?.failed ?? 0, costCents: Number(data?.actual_cost_cents ?? 0), done: data?.status !== "running" };
}

// Look up the next batch of numbers in a run.
export async function processChunk(db: SupabaseClient, runId: string, limit = CHUNK): Promise<RunProgress> {
  const { data: run } = await db.from("lookup_runs").select("id, status, include_caller_name").eq("id", runId).maybeSingle();
  if (!run || run.status !== "running") return progress(db, runId);
  const settings = await loadProspecting(db);
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const { data: items } = await db.from("lookup_run_items").select("phone_e164, attempts, claimed_at").eq("run_id", runId).eq("status", "queued")
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`).limit(limit);

  // Claim each one (skips any another worker took first).
  const claimed: { phone_e164: string; attempts: number }[] = [];
  const now = new Date().toISOString();
  for (const it of items ?? []) {
    let q = db.from("lookup_run_items").update({ claimed_at: now }).eq("run_id", runId).eq("phone_e164", it.phone_e164).eq("status", "queued");
    q = it.claimed_at ? q.eq("claimed_at", it.claimed_at) : q.is("claimed_at", null);
    const { data } = await q.select("phone_e164").maybeSingle();
    if (data) claimed.push(it);
  }

  let processed = 0, failed = 0, cost = 0;
  const touched: string[] = [];
  for (let i = 0; i < claimed.length; i += PARALLEL) {
    await Promise.all(claimed.slice(i, i + PARALLEL).map(async (it) => {
      const r = await twilioLookupDetail(it.phone_e164, { callerName: run.include_caller_name });
      const retry = r.status === 0 || r.status === 429 || r.status >= 500;
      if (r.status !== 200) {
        const attempts = it.attempts + 1;
        const give = !retry || attempts >= MAX_ATTEMPTS;
        await db.from("lookup_run_items").update({ attempts, claimed_at: null, ...(give ? { status: "failed", error: `Twilio ${r.status || "no response"}` } : {}) })
          .eq("run_id", runId).eq("phone_e164", it.phone_e164);
        if (give) failed++;
        return;
      }
      const m = mapCarrier(r.carrier, r.lineType);
      const c = lookupCost(settings, 1, run.include_caller_name);
      await db.from("phone_lookups").upsert({
        phone_e164: it.phone_e164, valid: r.valid, line_type: r.lineType, carrier_name: r.carrier?.slice(0, 200) ?? null,
        provider: m.provider, confidence: m.confidence, caller_name: r.callerName?.slice(0, 200) ?? null, caller_type: r.callerType?.slice(0, 40) ?? null,
        raw: r.raw, error_code: r.errorCode, cost_cents: c, looked_up_at: new Date().toISOString(),
      });
      await db.from("lookup_run_items").update({ status: "done", claimed_at: null }).eq("run_id", runId).eq("phone_e164", it.phone_e164);
      processed++; cost += c; touched.push(it.phone_e164);
    }));
  }
  if (touched.length) await rescore(db, touched);

  // Add this batch to the run's totals; close it when nothing's left.
  const { data: cur } = await db.from("lookup_runs").select("processed, failed, actual_cost_cents").eq("id", runId).single();
  const { count } = await db.from("lookup_run_items").select("phone_e164", { count: "exact", head: true }).eq("run_id", runId).eq("status", "queued");
  const left = count ?? 0;
  await db.from("lookup_runs").update({
    processed: (cur?.processed ?? 0) + processed, failed: (cur?.failed ?? 0) + failed,
    actual_cost_cents: Number(cur?.actual_cost_cents ?? 0) + cost,
    ...(left === 0 ? { status: "done", finished_at: new Date().toISOString() } : {}),
  }).eq("id", runId);
  return { ...(await progress(db, runId)), handled: processed + failed };
}

// Cron: finish runs nobody's page is driving (about 2 minutes of work at most).
export async function processLookupQueue(db: SupabaseClient, budgetMs = 120_000): Promise<number> {
  const until = Date.now() + budgetMs;
  const { data: runs } = await db.from("lookup_runs").select("id").eq("status", "running").order("created_at").limit(10);
  let n = 0;
  for (const r of runs ?? []) {
    while (Date.now() < until) {
      const p = await processChunk(db, r.id, 40);
      n += p.handled ?? 0;
      if (p.done || !p.handled) break; // finished, or the page is working on the rest
    }
  }
  return n;
}
