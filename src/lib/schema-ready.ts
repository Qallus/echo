import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Some features need a column that a migration adds (run by hand in the SQL
// Editor). Until it exists, the code skips the feature instead of failing.
// A "yes" is remembered for the life of the server; a "no" for a minute.
const known = new Map<string, { ok: boolean; at: number }>();

export async function columnReady(table: string, column: string, client?: SupabaseClient): Promise<boolean> {
  const key = `${table}.${column}`;
  const hit = known.get(key);
  if (hit && (hit.ok || Date.now() - hit.at < 60_000)) return hit.ok;
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from(table).select(column, { head: true }).limit(1);
  const missing = Boolean(error && (error.code === "42703" || /column .* does not exist|schema cache/i.test(error.message)));
  // Other errors (no access) don't tell us the column is missing.
  const ok = !missing;
  known.set(key, { ok, at: Date.now() });
  return ok;
}

type Filterable<T> = { is(column: string, value: null): T };
export type Filter = <T extends Filterable<T>>(q: T) => T;

// Redial staff's own CRM rows only (workspace_id is null), for staff tools,
// automations and webhooks. Before the workspace CRM migration every row is
// a staff row, so the filter does nothing. Returns a filter to apply to a
// query (a query runs when awaited, so it can't come back from here).
export async function staffFilter(table: string, client?: SupabaseClient): Promise<Filter> {
  return (await columnReady(table, "workspace_id", client)) ? (q) => q.is("workspace_id", null) : (q) => q;
}
