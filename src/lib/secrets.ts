import "server-only";
import { decryptKey } from "@/lib/ai/keys";
import { SECRET_KEYS } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";

// Service credentials: the value saved in Admin -> Settings -> Integrations
// (encrypted in platform_secrets), else the Coolify environment variable of
// the same name. Read with the service role, read-only and only this table,
// because email, texts, AI and payments need them in every kind of request,
// including webhooks with no user. Cached per server process for a minute.

let cache: { at: number; values: Map<string, string> } | null = null;
let loading: Promise<Map<string, string>> | null = null;
const TTL = 60_000;

async function load(): Promise<Map<string, string>> {
  const values = new Map<string, string>();
  try {
    const { data, error } = await createAdminClient().from("platform_secrets").select("key, ciphertext");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      try { values.set(row.key, decryptKey(row.ciphertext)); }
      catch { console.error(`[secrets] couldn't decrypt ${row.key}`); }
    }
  } catch (e) {
    console.error("[secrets] using environment only:", e instanceof Error ? e.message : e);
  }
  cache = { at: Date.now(), values };
  return values;
}

async function all() {
  if (cache && Date.now() - cache.at < TTL) return cache.values;
  loading ??= load().finally(() => { loading = null; });
  return loading;
}

export async function secret(key: string): Promise<string | undefined> {
  if (!SECRET_KEYS.has(key)) return process.env[key] || undefined;
  return (await all()).get(key) || process.env[key] || undefined;
}

export async function secrets<K extends string>(...keys: K[]): Promise<Record<K, string | undefined>> {
  const values = await all();
  return Object.fromEntries(keys.map((k) => [k, (SECRET_KEYS.has(k) ? values.get(k) : undefined) || process.env[k] || undefined])) as Record<K, string | undefined>;
}

// Where each key's value currently comes from (for the settings page).
export async function sources(keys: string[]): Promise<Record<string, "dashboard" | "coolify" | null>> {
  const values = await all();
  return Object.fromEntries(keys.map((k) => [k, values.has(k) ? "dashboard" : process.env[k] ? "coolify" : null]));
}

export function invalidateSecrets() { cache = null; }
