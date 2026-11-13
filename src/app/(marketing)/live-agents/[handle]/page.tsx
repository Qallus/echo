import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProfileView, type PublicReview } from "@/components/live-agents/profile-view";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { getFees, getLiveAgent, listSkills } from "@/lib/live-agents/data";
import { hiringWorkspaces } from "@/lib/live-agents/messages";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getLiveAgent((await params).handle);
  if (!a) return { title: "Live Agent not found · Redial" };
  return {
    title: `${a.displayName} · ${a.headline} · Redial Live Agents`,
    description: `${a.displayName} in ${a.city}, ${a.region}: ${a.headline}. ${a.yearsExperience} years experience, ${a.languages.join(" and ")}. Hear voice samples and book on Redial.`,
    alternates: { canonical: `/live-agents/${a.handle}` },
    robots: a.indexable ? undefined : { index: false, follow: true },
  };
}

// A Live Agent's public profile (live profiles only; RLS hides the rest).
export default async function LiveAgentProfile({ params }: Props) {
  const a = await getLiveAgent((await params).handle);
  if (!a) notFound();
  const supabase = await createClient();
  const [skills, fees, user, workspaces, { data: reviews }] = await Promise.all([
    listSkills(), getFees(), getUser(), hiringWorkspaces(), supabase.rpc("live_agent_public_reviews", { agent: a.id }),
  ]);
  return <ProfileView agent={a} skills={skills} fees={fees} hiring={{ signedIn: Boolean(user), workspaces }} reviews={(reviews ?? []) as PublicReview[]} />;
}
