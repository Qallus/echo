"use server";

import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { normalize, type Layout } from "./layout";

// Saves the Home dashboard layout to your own row (RLS: only yours).
export async function saveDashboard(layout: Layout): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const clean = normalize(layout);
  if (!clean) return { error: "That layout couldn't be read." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_dashboards")
    .upsert({ user_id: user.id, layout: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: /user_dashboards|schema cache/i.test(error.message) ? "offline" : error.message };
  return { ok: true };
}
