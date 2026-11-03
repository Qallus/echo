"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { TRANSCRIPTION_OPTIONS } from "@/lib/transcription/models";
import { getTranscriptionSetting } from "@/lib/transcription/run";

// Staff with ai.manage (the database policy checks again).
export async function setTranscription(provider: string, model: string): Promise<{ error?: string }> {
  await requireStaff("ai.manage");
  const option = TRANSCRIPTION_OPTIONS.find((o) => o.provider === provider && o.model === model);
  if (!option?.available) return { error: "That option isn't available yet." };
  const supabase = await createClient();
  const before = await getTranscriptionSetting(supabase);
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "transcription", value: { provider, model } }, { onConflict: "key" });
  if (error) return { error: error.message };
  await adminAudit(supabase, "ai.transcription.set", { type: "setting", id: "transcription" }, { from: before, to: { provider, model } });
  revalidatePath("/admin/ai");
  return {};
}
