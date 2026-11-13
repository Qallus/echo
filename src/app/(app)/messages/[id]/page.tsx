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
  const [{ data: a }, fees] = await Promise.all([
    supabase.from("live_agents").select("per_minute_cents, hourly_cents, retainer_cents, retainer_hours").eq("id", thread.agentId).maybeSingle(),
    getFees(),
  ]);
  return (
    <ThreadView thread={thread} fees={fees}
      rates={{ perMinuteCents: a?.per_minute_cents ?? null, hourlyCents: a?.hourly_cents ?? null, retainerCents: a?.retainer_cents ?? null, retainerHours: a?.retainer_hours ?? null }} />
  );
}
