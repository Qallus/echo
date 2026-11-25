import "server-only";
import { createClient } from "@/lib/supabase/server";

// Some features need a column that a migration adds (run by hand in the SQL
// Editor). Until it exists, the code skips the feature instead of failing.
// A "yes" is remembered for the life of the server; a "no" for a minute.
const known = new Map<string, { ok: boolean; at: number }>();

export async function columnReady(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const hit = known.get(key);
  if (hit && (hit.ok || Date.now() - hit.at < 60_000)) return hit.ok;
  const supabase = await createClient();
  const { error } = await supabase.from(table).select(column, { head: true }).limit(1);
  const ok = !error || !/column|does not exist|schema cache/i.test(error.message);
  known.set(key, { ok, at: Date.now() });
  return ok;
}
