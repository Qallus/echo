import "server-only";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Setup, SetupAnswers } from "./setup";

export type SetupContext = {
  setup: Setup;
  profile: { fullName: string; firstName: string; email: string; company: string; accountType: "personal" | "business"; phone: string };
  // Phone numbers on the account (text-message channels) and whether each is verified.
  phones: { id: string; number: string; verified: boolean }[];
  // The person's own Redial line, once one is assigned.
  line: { id: string; number: string } | null;
};

// Everything the setup wizard needs, as the signed-in person (RLS).
export async function loadSetup(): Promise<SetupContext> {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: row }, { data: profile }, { data: channels }, { data: lines }] = await Promise.all([
    supabase.from("redial_setups").select("step, status, answers, line_id, staff_note").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, company, account_type, phone").eq("id", user.id).maybeSingle(),
    supabase.from("notification_channels").select("id, address, verified_at").eq("user_id", user.id).eq("kind", "sms").order("created_at"),
    supabase.from("redial_lines").select("id, number").eq("owner_id", user.id).order("created_at").limit(1),
  ]);
  const answers = (row?.answers ?? {}) as SetupAnswers;
  const fullName = answers.about?.fullName ?? profile?.full_name ?? "";
  return {
    setup: { step: row?.step ?? 1, status: row?.status ?? "draft", answers, line_id: row?.line_id ?? null, staff_note: row?.staff_note ?? null },
    profile: {
      fullName, firstName: fullName.split(" ")[0] ?? "", email: user.email, company: profile?.company ?? "",
      accountType: profile?.account_type === "business" ? "business" : "personal", phone: profile?.phone ?? "",
    },
    phones: (channels ?? []).map((c) => ({ id: c.id, number: c.address, verified: Boolean(c.verified_at) })),
    line: lines?.[0] ?? null,
  };
}

// What's done, for the review step and the home page card.
export function readiness(ctx: SetupContext) {
  const a = ctx.setup.answers;
  return [
    { key: "account", label: "Account and mobile number", done: Boolean(a.about?.phone) },
    { key: "phone", label: "Your phone and carrier", done: Boolean(a.phone?.carrier) },
    { key: "route", label: "How calls reach Redial", done: Boolean(a.route?.method) },
    { key: "assistant", label: "Your assistant", done: Boolean(a.assistant?.name) },
    { key: "alerts", label: "Alerts and ring number", done: Boolean(a.after) },
    { key: "number", label: ctx.line ? "Your Redial number" : "Your Redial number (we set this up)", done: Boolean(ctx.line) },
  ];
}
