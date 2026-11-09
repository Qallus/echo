import "server-only";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Setup, SetupAnswers } from "./setup";

export type SetupContext = {
  setup: Setup;
  profile: { fullName: string; company: string; accountType: "personal" | "business"; phone: string };
  // Phone numbers on the account (text-message channels) and whether each is verified.
  phones: { id: string; number: string; verified: boolean }[];
};

// Everything the setup wizard needs, as the signed-in person (RLS).
export async function loadSetup(): Promise<SetupContext> {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: row }, { data: profile }, { data: channels }] = await Promise.all([
    supabase.from("redial_setups").select("step, status, answers, line_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, company, account_type, phone").eq("id", user.id).maybeSingle(),
    supabase.from("notification_channels").select("id, address, verified_at").eq("user_id", user.id).eq("kind", "sms").order("created_at"),
  ]);
  return {
    setup: { step: row?.step ?? 1, status: row?.status ?? "draft", answers: (row?.answers ?? {}) as SetupAnswers, line_id: row?.line_id ?? null },
    profile: {
      fullName: profile?.full_name ?? "", company: profile?.company ?? "",
      accountType: profile?.account_type === "business" ? "business" : "personal", phone: profile?.phone ?? "",
    },
    phones: (channels ?? []).map((c) => ({ id: c.id, number: c.address, verified: Boolean(c.verified_at) })),
  };
}
