"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isRange } from "@/lib/admin/ranges";
import { reportDef } from "@/lib/admin/reports";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string; id?: string };

export async function saveReport(input: { name: string; kind: string; range: string; since?: string; until?: string; shared: boolean }): Promise<Result> {
  await requireStaff("analytics.view");
  const name = input.name.trim().slice(0, 120);
  if (!name) return { error: "Give the report a name." };
  if (!reportDef(input.kind) || !isRange(input.range)) return { error: "Choose a report and range." };
  const custom = input.range === "custom";
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_reports").insert({
    name, kind: input.kind, range: input.range, since: custom ? input.since : null, until: custom ? input.until : null, shared: input.shared,
  }).select("id").single();
  if (error) return { error: error.message };
  await adminAudit(supabase, "reports.save", { type: "saved_report", id: data.id }, { kind: input.kind, shared: input.shared });
  revalidatePath("/admin/reports");
  return { ok: "Saved.", id: data.id };
}

export async function deleteReport(id: string): Promise<Result> {
  await requireStaff("analytics.view");
  const supabase = await createClient();
  const { error, count } = await supabase.from("saved_reports").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the person who saved a report can delete it." };
  await adminAudit(supabase, "reports.delete", { type: "saved_report", id });
  revalidatePath("/admin/reports");
  return { ok: "Deleted." };
}
