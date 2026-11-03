import { connection } from "next/server";
import { MODELS } from "@/lib/ai/models";
import { configuredProviders, customerKeys } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// The models this user can pick: built-in providers enabled in Super Admin
// with an Echo key, or any provider they've added their own key for, plus
// enabled custom providers. Never returns keys.
export async function GET() {
  await connection(); // read env at request time, not build time
  if (!(await getUser())) return Response.json([], { status: 401 });
  const supabase = await createClient();
  const [settings, keys, custom, configured] = await Promise.all([
    getAiSettings(supabase),
    customerKeys(supabase),
    supabase.from("ai_custom_providers").select("id, name, model").eq("enabled", true).order("name"),
    configuredProviders(),
  ]);
  const own = new Set(keys.map((k) => k.provider));
  const builtIn = MODELS
    .filter((m) => settings.enabled.includes(m.id) || own.has(m.id))
    .map((m) => ({ ...m, available: own.has(m.id) || (settings.enabled.includes(m.id) && configured[m.id]), ownKey: own.has(m.id) }));
  const customs = (custom.data ?? []).map((c) => ({ id: `custom:${c.id}`, label: c.name, vendor: c.model, available: true, ownKey: false }));
  // The Super Admin default first.
  const list = [...builtIn, ...customs].sort((a, b) => Number(b.id === settings.defaultChat) - Number(a.id === settings.defaultChat));
  return Response.json(list);
}
