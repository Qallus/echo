import Link from "next/link";
import { ArrowLeft, Briefcase, Clock, Flag, Globe2, MapPin, MessageCircle, Star } from "lucide-react";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { AvailabilityGrid } from "@/components/live-agents/availability-grid";
import { AreaMap, BookingCard } from "@/components/live-agents/booking-card";
import { AgentBadges, IconByName } from "@/components/live-agents/icons";
import { VoiceSamplePlayer } from "@/components/live-agents/voice-sample";
import type { Hiring } from "@/components/live-agents/message-button";
import { EQUIPMENT, firstName, replyLabel, tzLabel, WORKSPACE, type Fees, type LiveAgent, type Skill } from "@/lib/live-agents/types";

// A Live Agent's profile: the public page, and the agent's own preview
// (preview: no booking, a note on clips still waiting for review).
export function ProfileView({ agent: a, skills, fees, preview = false, pendingClips = [], hiring }: {
  agent: LiveAgent; skills: Skill[]; fees: Fees; preview?: boolean; pendingClips?: string[]; hiring?: Hiring;
}) {
  const name = firstName(a.displayName);
  const mine = a.skills.map((s) => skills.find((k) => k.slug === s)).filter((s) => s != null);
  const reply = replyLabel(a.replyMinutes);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6">
      {!preview && <Link href="/live-agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to Live Agents</Link>}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <AgentAvatar name={a.displayName} url={a.avatarUrl} online={a.availableNow} size="lg" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{a.displayName}</h1>
                {a.availableNow && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">● Available now</span>}
              </div>
              <p className="text-lg text-muted-foreground">{a.headline}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {a.city}, {a.region} · {tzLabel(a.timeZone)}</span>
                {a.rating != null && <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-current" /> {a.rating.toFixed(2)} · {a.reviewCount} reviews</span>}
                {reply && <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> {reply}</span>}
                <span className="inline-flex items-center gap-1"><Briefcase className="size-3.5" /> {a.yearsExperience} years experience</span>
                {a.engagementCount > 0 && <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {a.engagementCount} engagements</span>}
              </p>
              <AgentBadges badges={a.badges} demo={a.isDemo} />
            </div>
          </header>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Voice samples</h2>
              <p className="text-sm text-muted-foreground">
                Short clips {name} recorded for this profile{a.samples.some((s) => s.aiVoice) ? " (this demo profile uses AI voices)" : ""}. Up to 3, 30 seconds each.
              </p>
            </div>
            {a.samples.length ? (
              <div className="space-y-2">
                {a.samples.map((s) => (
                  <div key={s.id}>
                    <VoiceSamplePlayer sample={s} showTranscript />
                    {pendingClips.includes(s.id) && <p className="mt-1 text-xs text-muted-foreground">Waiting for review: businesses will hear this once it&apos;s approved.</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Voice samples coming soon.</p>
            )}
          </section>

          {a.bio && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">About</h2>
              <p className="text-muted-foreground">{a.bio}</p>
            </section>
          )}

          {mine.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">What {name} does</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {mine.map((s) => (
                  <div key={s.slug} className="flex items-center gap-3 rounded-xl border p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><IconByName name={s.icon} className="size-4" /></span>
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {a.experience.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Experience</h2>
              <ul className="divide-y rounded-xl border">
                {a.experience.map((e, i) => (
                  <li key={i} className="p-4">
                    <p className="font-medium">{e.title}</p>
                    {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(a.equipment.length > 0 || a.workspace.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Workspace and equipment</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[{ title: "Where they work", items: WORKSPACE.filter((w) => a.workspace.includes(w.slug)) }, { title: "Equipment", items: EQUIPMENT.filter((e) => a.equipment.includes(e.slug)) }]
                  .filter((g) => g.items.length).map((g) => (
                    <div key={g.title} className="rounded-xl border p-4">
                      <p className="text-sm font-medium">{g.title}</p>
                      <ul className="mt-2 space-y-1.5">
                        {g.items.map((i) => <li key={i.slug} className="flex items-center gap-2 text-sm text-muted-foreground"><IconByName name={i.icon} className="size-4 shrink-0" /> {i.label}</li>)}
                      </ul>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Globe2 className="size-4" /> Languages</h2>
              <div className="flex flex-wrap gap-1.5">{a.languages.map((l) => <span key={l} className="rounded-md border px-2 py-1 text-sm">{l}</span>)}</div>
            </div>
            {a.industries.length > 0 && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Briefcase className="size-4" /> Industries</h2>
                <div className="flex flex-wrap gap-1.5">{a.industries.map((l) => <span key={l} className="rounded-md border px-2 py-1 text-sm">{l}</span>)}</div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Weekly availability</h2>
              <p className="text-sm text-muted-foreground">{tzLabel(a.timeZone)}. Shifts outside these hours can be requested.</p>
            </div>
            <AvailabilityGrid availability={a.availability} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Reviews from businesses</h2>
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {a.reviewCount ? `${a.reviewCount} reviews` : "No reviews yet."} Reviews appear after both the business and the Live Agent have reviewed each other.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Area</h2>
            <AreaMap agent={a} />
            <p className="text-xs text-muted-foreground">Shown by area only (about 3 km), never a home address. Live Agents work remotely and can cover any US time zone.</p>
          </section>

          <Link href="/contact" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Flag className="size-3.5" /> Report this profile
          </Link>
        </div>

        <aside className="lg:sticky lg:top-20">
          <BookingCard agent={a} fees={fees} name={name} preview={preview} hiring={hiring} />
        </aside>
      </div>
    </div>
  );
}
