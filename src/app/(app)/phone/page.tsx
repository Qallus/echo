import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { PhoneView, type LineCall, type LinePhone } from "@/components/phone/phone-view";
import { listWorkspaces, requireUser } from "@/lib/data";
import { lineNumber } from "@/lib/line/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Phone · Echo" };

// The Echo call line: verify your cell, then place recorded calls (they see
// your own number) or merge the line into a call you're already on.
export default async function PhonePage() {
  const user = await requireUser();
  const line = await lineNumber();
  if (!line) notFound();
  const supabase = await createClient();
  const [{ data: phone }, { data: calls }, workspaces] = await Promise.all([
    supabase.from("call_line_phones").select("number, status, validation_code, workspace_id, ask_workspace, announce, verified_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("call_line_calls").select("id, kind, to_number, status, error, recording_id, duration_seconds, created_at").order("created_at", { ascending: false }).limit(30),
    listWorkspaces(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Phone className="size-7" /> Phone</h1>
        <p className="text-sm text-muted-foreground">Record your phone calls into Echo. They&apos;re transcribed and summarized like any recording.</p>
      </div>
      <PhoneView line={line} phone={(phone ?? null) as LinePhone | null} calls={(calls ?? []) as LineCall[]} workspaces={workspaces} />
    </div>
  );
}
