"use server";

import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TRANSCRIPTION_OPTIONS } from "@/lib/transcription/models";

// Super Admin only (the database policy checks again).
export async function setTranscription(provider: string, model: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: "Super admins only." };
  const option = TRANSCRIPTION_OPTIONS.find((o) => o.provider === provider && o.model === model);
  if (!option?.available) return { error: "That option isn't available yet." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "transcription", value: { provider, model } }, { onConflict: "key" });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return {};
}
