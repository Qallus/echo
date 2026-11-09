import Link from "next/link";
import {
  Briefcase, CalendarClock, FileAudio, Lock, MessageSquareText, Mic, PhoneIncoming, PictureInPicture2, Plug, Search, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { CallFlowSection } from "@/components/marketing/home/call-flow";
import { LiveControlsSection } from "@/components/marketing/home/live-controls";
import { ProblemSection } from "@/components/marketing/home/problem";
import { UseCasesSection } from "@/components/marketing/home/use-cases";
import { MobileAppSection } from "@/components/marketing/mobile-app-section";
import { ALL_FAQ } from "@/lib/faq";

export const metadata = {
  title: "Redial · Your AI assistant answers. You take the calls that matter.",
  description:
    "Redial's AI assistant, DJ, answers your calls, finds out who's calling and why, and only interrupts you when it matters. Listen in, guide it, take over or transfer, all on the same call. Every call is recorded, transcribed and summarized with Echo.",
};

const FEATURES = [
  { icon: Mic, title: "Record in the browser", desc: "One click to record a meeting or call, from your microphone or a shared Meet, Zoom or Teams tab." },
  { icon: PictureInPicture2, title: "Notes that stay on top", desc: "Pop the recorder out over your meeting. Notes and flags are saved at the exact moment they happened." },
  { icon: MessageSquareText, title: "Transcripts with speakers", desc: "Every recording is transcribed automatically, labelled by speaker and time." },
  { icon: Search, title: "Search everything", desc: "Find any word across titles, transcripts and summaries, and jump straight to the recording." },
  { icon: Sparkles, title: "Ask Echo", desc: "Ask Claude, ChatGPT, Gemini or Grok about one recording or your whole library." },
  { icon: FileAudio, title: "Bring your audio", desc: "Drag audio files from your computer anywhere onto Echo. MP3, M4A, WAV and more." },
];

// Everything else Redial does, beyond the live call controls.
const REDIAL_MORE = [
  { icon: PhoneIncoming, title: "AI call screening", desc: "DJ answers, asks who's calling and why, then takes a message or puts the call through to you." },
  { icon: ShieldCheck, title: "Rules, VIPs and blocks", desc: "Screen unknown callers or everyone. VIPs ring straight through, and blocked numbers never get through." },
  { icon: CalendarClock, title: "Messages and callbacks", desc: "Every call ends as a summary, message or voicemail transcript, with callback reminders when you need them." },
  { icon: UsersRound, title: "Share a line", desc: "Give a teammate or family member exactly what they need: summaries, transcripts, listening or taking over." },
];


const STEPS = [
  { n: "1", title: "Record or drop a file", desc: "Choose Business or Personal first, so every recording lands in the right place." },
  { n: "2", title: "Echo transcribes it", desc: "A speaker-labelled transcript appears a minute or two later, ready to read and search." },
  { n: "3", title: "Find, ask and share", desc: "Search across everything, ask questions in plain words, and keep your team in the loop." },
];

const FAQ = ALL_FAQ.filter((f) => f.home);

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <CallFlowSection />
      <LiveControlsSection />
      <UseCasesSection />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Everything else Redial does</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REDIAL_MORE.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-background p-5">
                <Icon className="mb-3 size-5" />
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileAppSection />

      <section id="features" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">Echo, built into Redial</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Every call and meeting, kept</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Echo records, transcribes and summarizes every call, and your meetings too, so you can pay attention to the people.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-background p-5">
                <Icon className="mb-3 size-5" />
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">How Echo works</h2>
          {[{ name: "Echo", icon: Mic, steps: STEPS }].map(({ name, icon: Icon, steps }) => (
            <div key={name} id={`how-${name.toLowerCase()}`} className="mt-10 scroll-mt-24">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Icon className="size-4" /> {name}</h3>
              <ol className="mt-4 grid gap-8 md:grid-cols-3">
                {steps.map((s) => (
                  <li key={s.n} className="space-y-2">
                    <span className="flex size-8 items-center justify-center rounded-full border bg-background text-sm font-medium">{s.n}</span>
                    <h4 className="font-medium">{s.title}</h4>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">For your team, and just for you</h2>
            <p className="mt-3 text-muted-foreground">
              Every account has a private Personal space. Add a Business workspace for your company, invite your team,
              and decide recording by recording who hears what.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-5">
              <Briefcase className="mb-3 size-5" />
              <h3 className="font-medium">Business</h3>
              <p className="mt-1 text-sm text-muted-foreground">Shared with everyone you invite. Owners and admins manage the team.</p>
            </div>
            <div className="rounded-xl border bg-background p-5">
              <Lock className="mb-3 size-5" />
              <h3 className="font-medium">Personal</h3>
              <p className="mt-1 text-sm text-muted-foreground">Only you. Move a recording to Business when you&apos;re ready to share it.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div>
          <Plug className="mb-3 size-5" />
          <h2 className="text-3xl font-semibold tracking-tight">Use Echo from Claude</h2>
          <p className="mt-3 text-muted-foreground">
            Connect Echo to Claude on the web, on your phone, or in Claude Code. Claude can find recordings, read
            transcripts, write summaries and track action items, with exactly the access you have.
          </p>
        </div>
        <ul className="space-y-3 text-sm">
          {[
            "What did we decide about the launch date?",
            "Mark the first two action items from yesterday's planning call as done.",
            "Move every recording with “Acme” in the title into the Clients folder.",
          ].map((q) => (
            <li key={q} className="rounded-xl border bg-muted/30 px-4 py-3">&ldquo;{q}&rdquo;</li>
          ))}
        </ul>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y rounded-xl border bg-background">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">{f.q}<span className="text-muted-foreground transition-transform group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground"><Link href="/faq" className="font-medium text-foreground underline underline-offset-2">See all questions</Link>, searchable by topic.</p>
        </div>
      </section>
    </>
  );
}
