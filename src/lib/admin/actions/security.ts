"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

// Owners only. Turns the two-step sign-in requirement for staff on or off;
// the database (private.mfa_verified) reads the same setting.
export async function setRequireMfa(on: boolean): Promise<{ ok?: string; error?: string }> {
  await requireStaff("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "admin_security", value: { requireMfa: on } });
  if (error) return { error: error.message };
  await adminAudit(supabase, on ? "security.mfa.require" : "security.mfa.off", { type: "setting", id: "admin_security" });
  revalidatePath("/admin", "layout");
  return { ok: on ? "Two-step sign-in is required for staff again." : "Two-step sign-in is off for staff. Turn it back on before launch." };
}
