import "server-only";
import { createSign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { secrets } from "@/lib/secrets";

// Google Search Console -> search_console_rows (by day, search term and page).
// Signs in as Redial's Google service account (the JSON key saved in
// Admin -> Settings -> Integrations -> Google Workspace), which must be added
// as a user on the redial.si property in Search Console. Read-only scope.
// Google's numbers lag about 2 days; the daily job copies the last few days,
// and the first sync goes back 90 days.

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type Key = { client_email: string; private_key: string };

export async function searchConsoleConfig(): Promise<{ key: Key | null; property: string; email: string | null }> {
  const s = await secrets("GOOGLE_WORKSPACE_SERVICE_ACCOUNT", "SEARCH_CONSOLE_PROPERTY");
  let key: Key | null = null;
  try { const k = JSON.parse(s.GOOGLE_WORKSPACE_SERVICE_ACCOUNT ?? ""); if (k.client_email && k.private_key) key = k; } catch { key = null; }
  return { key, property: s.SEARCH_CONSOLE_PROPERTY || "sc-domain:redial.si", email: key?.client_email ?? null };
}

async function accessToken(key: Key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, cache: "no-store",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`Google sign-in failed: ${j.error_description ?? res.status}`);
  return j.access_token;
}

const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

export async function syncSearchConsole(db: SupabaseClient, opts: { force?: boolean } = {}): Promise<{ rows?: number; error?: string; skipped?: boolean }> {
  const { key, property } = await searchConsoleConfig();
  if (!key) return { error: "Add Redial's Google service account key in Admin -> Settings -> Integrations -> Google." };
  const { data: last } = await db.from("search_console_rows").select("day").order("day", { ascending: false }).limit(1).maybeSingle();
  // Daily: skip when the newest day Google has is already here.
  if (!opts.force && last?.day && last.day >= day(-3)) return { skipped: true };
  const start = last?.day ? day(-6) : day(-90);
  const end = day(-1);
  try {
    const token = await accessToken(key);
    let total = 0;
    for (let startRow = 0; startRow < 100000; startRow += 25000) {
      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["date", "query", "page"], rowLimit: 25000, startRow, dataState: "final" }),
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[]; error?: { message?: string } };
      if (!res.ok) {
        const msg = j.error?.message ?? `Search Console said ${res.status}`;
        return { error: res.status === 403 ? `${msg}. Add the service account as a user on ${property} in Search Console.` : msg };
      }
      const rows = (j.rows ?? []).map((r) => ({
        day: r.keys[0], query: r.keys[1].slice(0, 300), page: r.keys[2].slice(0, 500),
        clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: Math.round(r.position * 100) / 100,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("search_console_rows").upsert(rows.slice(i, i + 500), { onConflict: "day,query,page" });
        if (error) return { error: error.message };
      }
      total += rows.length;
      if ((j.rows ?? []).length < 25000) break;
    }
    return { rows: total };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search Console sync failed." };
  }
}
