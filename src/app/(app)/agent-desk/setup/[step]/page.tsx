import { notFound, redirect } from "next/navigation";
import { AgentSetupShell } from "@/components/live-agents/setup/agent-setup-shell";
import { BasicsStep } from "@/components/live-agents/setup/basics-step";
import { ExperienceStep } from "@/components/live-agents/setup/experience-step";
import { PhotoStep } from "@/components/live-agents/setup/photo-step";
import { RatesStep } from "@/components/live-agents/setup/rates-step";
import { ReviewStep, type ReviewRow } from "@/components/live-agents/setup/review-step";
import { SkillsStep } from "@/components/live-agents/setup/skills-step";
import { VoiceStep } from "@/components/live-agents/setup/voice-step";
import { WorkspaceStep } from "@/components/live-agents/setup/workspace-step";
import { getMyProfile, requireUser } from "@/lib/data";
import { myLiveAgent, profileGaps, profileStrength } from "@/lib/live-agents/agent-data";
import { getFees, listSkills } from "@/lib/live-agents/data";
import { agentStepAt } from "@/lib/live-agents/setup";
import { ATTRIBUTES, money, WEEKDAYS } from "@/lib/live-agents/types";
import { myStudioAudio } from "@/lib/studio/data";

export const metadata = { title: "Build your Live Agent profile · Redial" };

export default async function AgentSetupStep({ params }: { params: Promise<{ step: string }> }) {
  const n = Number((await params).step);
  const step = agentStepAt(n);
  if (!step) notFound();
  const user = await requireUser();
  const agent = await myLiveAgent();
  if (!agent && n !== 1) redirect("/agent-desk/setup/1");
  if (agent?.status === "suspended") redirect("/agent-desk");
  if (agent && n > agent.setupStep) redirect(`/agent-desk/setup/${agent.setupStep}`);

  let body: React.ReactNode = null;
  if (step.key === "basics") {
    const profile = await getMyProfile();
    const [first = "", ...rest] = (profile.fullName ?? "").trim().split(/\s+/);
    body = <BasicsStep initial={agent
      ? { firstName: agent.displayName.split(" ")[0], lastName: agent.displayName.split(" ")[1]?.replace(".", "") ?? "", headline: agent.headline, city: agent.city, region: agent.region, timeZone: agent.timeZone }
      : { firstName: first, lastName: rest.join(" "), headline: "", city: "", region: "", timeZone: "America/Phoenix" }} />;
  } else if (agent && step.key === "photo") {
    body = <PhotoStep userId={user.id} name={agent.displayName} url={agent.avatarUrl} />;
  } else if (agent && step.key === "experience") {
    body = <ExperienceStep initial={{ years: agent.yearsExperience, bio: agent.bio ?? "", experience: agent.experience, industries: agent.industries }} />;
  } else if (agent && step.key === "skills") {
    body = <SkillsStep catalog={await listSkills()} initial={{ skills: agent.skills, languages: agent.languages }} />;
  } else if (agent && step.key === "workspace") {
    body = <WorkspaceStep initial={{ equipment: agent.equipment, workspace: agent.workspace }} />;
  } else if (agent && step.key === "voice") {
    const studio = (await myStudioAudio()).filter((s) => !s.archived_at && s.duration_seconds != null && s.duration_seconds <= 31)
      .map((s) => ({ id: s.id, name: s.name, duration: Number(s.duration_seconds) }));
    body = <VoiceStep userId={user.id} clips={agent.samples} clipStatus={agent.clipStatus} studio={studio} />;
  } else if (agent && step.key === "rates") {
    body = <RatesStep fees={await getFees()} initial={{ perMinuteCents: agent.perMinuteCents, hourlyCents: agent.hourlyCents, retainerCents: agent.retainerCents, retainerHours: agent.retainerHours, availability: agent.availability }} />;
  } else if (agent && step.key === "review") {
    const skills = await listSkills();
    const days = WEEKDAYS.filter(({ key }) => agent.availability[key]).map(({ short }) => short);
    const rates = [agent.perMinuteCents != null && `${money(agent.perMinuteCents, { exact: true })}/min`, agent.hourlyCents != null && `${money(agent.hourlyCents)}/hr`, agent.retainerCents != null && `${money(agent.retainerCents)}/mo for ${agent.retainerHours} hrs`].filter(Boolean).join(" · ");
    const rows: ReviewRow[] = [
      { step: 1, label: "Name and headline", value: `${agent.displayName} · ${agent.headline} · ${agent.city}, ${agent.region}`, ok: true },
      { step: 2, label: "Photo", value: agent.avatarUrl ? "Added" : "Not added yet", ok: Boolean(agent.avatarUrl) },
      { step: 3, label: "Experience", value: `${agent.yearsExperience} years · ${agent.bio ? `${agent.bio.slice(0, 80)}${agent.bio.length > 80 ? "…" : ""}` : "No bio yet"}`, ok: Boolean(agent.bio && agent.bio.length >= 40) },
      { step: 4, label: "Skills and languages", value: `${agent.skills.map((s) => skills.find((k) => k.slug === s)?.label ?? s).join(", ") || "None yet"} · ${agent.languages.join(", ")}`, ok: agent.skills.length >= 2 },
      { step: 5, label: "Workspace and equipment", value: [...agent.equipment, ...agent.workspace].map((s) => ATTRIBUTES.find((x) => x.slug === s)?.label ?? s).join(", ") || "Not added yet", ok: agent.equipment.length > 0 && agent.workspace.length > 0 },
      { step: 6, label: "Voice clips", value: agent.samples.length ? agent.samples.map((s) => s.title).join(", ") : "None yet", ok: agent.samples.length > 0 },
      { step: 7, label: "Rates and hours", value: `${rates || "No rates yet"}${days.length ? ` · ${days.join(", ")}` : ""}`, ok: Boolean(rates && days.length) },
    ];
    body = <ReviewStep rows={rows} gaps={profileGaps(agent)} status={agent.status} />;
  }

  return (
    <AgentSetupShell step={n} reached={agent?.setupStep ?? 1} strength={agent ? profileStrength(agent) : 0} hasProfile={Boolean(agent)}
      note={agent?.status === "draft" ? agent.reviewNote : null}>
      {body}
    </AgentSetupShell>
  );
}
