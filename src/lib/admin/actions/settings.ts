"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { readOrg, type Organization } from "@/lib/settings/organization";
import { createClient } from "@/lib/supabase/server";

// Organization details (platform_settings "organization").
export async function saveOrganization(input: Organization): Promise<{ ok?: string; error?: string }> {
  await requireStaff("settings.manage");
  const o = readOrg(input);
  const clip = (s: string, n: number) => s.trim().slice(0, n);
  const value: Organization = {
    name: clip(o.name, 120), legalName: clip(o.legalName, 160), email: clip(o.email, 200), phone: clip(o.phone, 40),
    address: clip(o.address, 300), website: clip(o.website, 200), timezone: clip(o.timezone, 60),
  };
  if (!value.name) return { error: "Enter your company name." };
  if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) return { error: "Enter a valid email address." };
  try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }); } catch { return { error: "Choose a valid time zone." }; }
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert({ key: "organization", value });
  if (error) return { error: error.message };
  await adminAudit(supabase, "settings.organization.save", { type: "setting", id: "organization" }, { name: value.name, timezone: value.timezone });
  revalidatePath("/admin", "layout");
  return { ok: "Saved." };
}
