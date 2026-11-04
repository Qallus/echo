"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };
const STATUSES = ["waiting", "notified", "invited", "joined", "unsubscribed"];

// App waitlist status (waiting -> notified -> invited -> joined, or unsubscribed).
export async function setWaitlistStatus(id: string, status: string): Promise<Result> {
  await requireStaff("comms.manage");
  if (!STATUSES.includes(status)) return { error: "Choose a status." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("app_waitlist").update({ status }, { count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Entry not found." };
  await adminAudit(supabase, "waitlist.status", { type: "app_waitlist", id }, { status });
  revalidatePath("/admin/waitlist");
  return { ok: "Updated." };
}
