import {
  CalendarClock, FileAudio, MessageSquareText, Mic, PhoneIncoming, PictureInPicture2, Plug, Search, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { CallFlowSection } from "@/components/marketing/home/call-flow";
import { LiveControlsSection } from "@/components/marketing/home/live-controls";
import { ProblemSection } from "@/components/marketing/home/problem";
import { UseCasesSection } from "@/components/marketing/home/use-cases";
import { MobileAppSection } from "@/components/marketing/mobile-app-section";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { KeepNumberSection } from "@/components/marketing/home/keep-number";
import { PricingPreviewSection } from "@/components/marketing/home/pricing-preview";
import { TrustSection } from "@/components/marketing/home/trust";
import { FAQ_TOPICS } from "@/lib/faq";

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

// Home questions, Redial first.
const ORDER = ["redial", "live", "sharing", "billing"];
const FAQ = [...FAQ_TOPICS].sort((x, y) => (ORDER.indexOf(x.id) + 1 || 99) - (ORDER.indexOf(y.id) + 1 || 99)).flatMap((t) => t.items).filter((f) => f.home);

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <CallFlowSection />
      <LiveControlsSection />
      <UseCasesSection />
      <KeepNumberSection />

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

      <section id="features" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">Echo, built into Redial</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Every call becomes notes. Your meetings too.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Every call DJ handles comes with a recording, a transcript and a summary. Echo does the same for your meetings, so you can pay attention to the people.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-background p-5">
                <Icon className="mb-3 size-5" />
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div id="how-echo" className="mt-14 scroll-mt-24">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Mic className="size-4" /> How Echo works</h3>
            <ol className="mt-4 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="space-y-2">
                  <span className="flex size-8 items-center justify-center rounded-full border bg-background text-sm font-medium">{s.n}</span>
                  <h4 className="font-medium">{s.title}</h4>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <PricingPreviewSection />
      <TrustSection />
      <MobileAppSection />

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <Plug className="mb-3 size-5" />
            <h2 className="text-3xl font-semibold tracking-tight">Use Redial and Echo from Claude</h2>
            <p className="mt-3 text-muted-foreground">
              Connect your account to Claude on the web, on your phone, or in Claude Code. Claude can find recordings, read
              transcripts, track action items and manage your calendar, with exactly the access you have.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "What did we decide about the launch date?",
              "Put a call with Dana on my calendar for tomorrow at 10.",
              "Mark the first two action items from yesterday's planning call as done.",
            ].map((q) => (
              <li key={q} className="rounded-xl border bg-muted/30 px-4 py-3">&ldquo;{q}&rdquo;</li>
            ))}
          </ul>
        </div>
      </section>

      <FaqSection items={FAQ} />
      <FinalCta />
    </>
  );
}
