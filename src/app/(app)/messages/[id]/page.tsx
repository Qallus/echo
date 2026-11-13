import { notFound } from "next/navigation";
import { ThreadView } from "@/components/live-agents/inbox/thread-view";
import { getFees } from "@/lib/live-agents/data";
import { getThread } from "@/lib/live-agents/messages";
import { createClient } from "@/lib/supabase/server";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const thread = await getThread((await params).id);
  if (!thread) notFound();
  const supabase = await createClient();
  // The agent's rates prefill offers (live profiles and the agent's own row are readable).
  const [{ data: a }, fees, { data: lines }] = await Promise.all([
    supabase.from("live_agents").select("per_minute_cents, hourly_cents, retainer_cents, retainer_hours").eq("id", thread.agentId).maybeSingle(),
    getFees(),
    // The business's own Redial lines, to route a booking's calls.
    thread.side === "business" ? supabase.from("redial_lines").select("id, label, number").eq("owner_id", (await supabase.auth.getUser()).data.user?.id ?? "") : Promise.resolve({ data: [] }),
  ]);
  return (
    <ThreadView thread={thread} fees={fees} lines={(lines ?? []) as { id: string; label: string; number: string }[]}
      rates={{ perMinuteCents: a?.per_minute_cents ?? null, hourlyCents: a?.hourly_cents ?? null, retainerCents: a?.retainer_cents ?? null, retainerHours: a?.retainer_hours ?? null }} />
  );
}
