"use server";

import { revalidatePath } from "next/cache";
import { isUuid, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Disconnects an app (e.g. Claude) from your Echo account: Supabase revokes
// the consent and its tokens.
export async function revokeGrant(clientId: string): Promise<{ error?: string }> {
  await requireUser();
  if (!isUuid(clientId)) return { error: "Unknown app." };
  const supabase = await createClient();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) return { error: error.message };
  revalidatePath("/developer");
  return {};
}
