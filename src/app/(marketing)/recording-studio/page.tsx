import Link from "next/link";
import {
  ArrowRight, AudioLines, CalendarDays, Clock, Drum, FileAudio, Hash, Headphones, LayoutGrid, Link2, ListOrdered, Mic, Music, PhoneForwarded,
  Sparkles, SquareKanban, Table as TableIcon, Upload, Voicemail, Volume2, Wand2,
} from "lucide-react";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { CompareTable } from "@/components/marketing/phones/compare-table";
import { FaqJsonLd, FeatureGrid, SectionHead, StepsSection } from "@/components/marketing/phones/sections";
import { StudioArt } from "@/components/marketing/studio/studio-art";
import { Button } from "@/components/ui/button";
import { FAQ_TOPICS } from "@/lib/faq";

export const metadata = {
  title: "Redial Recording Studio · Greetings, phone menus and hold messages",
  description: "Make professional greetings, extension prompts, phone menus and hold messages in minutes. Record your voice, upload a file, or choose from dozens of AI voices from OpenAI, xAI and Gemini, then add music from the drum machine or AI Beats.",
  alternates: { canonical: "/recording-studio" },
};

const VOICE_WAYS = [
  { icon: Mic, title: "Record your voice", desc: "Record from your browser's microphone and see the waveform as soon as you stop. Do it again until it sounds right." },
  { icon: Upload, title: "Upload a recording", desc: "Already have a greeting from a voice artist? Upload WAV, MP3, M4A and more, or reuse anything in your library." },
  { icon: Sparkles, title: "Use an AI voice", desc: "Type the script, choose a voice and a speed, and it's ready in seconds. Every take is saved to your library." },
];

const ENGINES = [
  { name: "OpenAI", count: "10 voices", sample: "Alloy, Ash, Coral, Nova, Onyx, Shimmer…" },
  { name: "xAI (Grok)", count: "28 voices", sample: "Ara, Eve, Leo, Rex, Altair, Aurora, Cosmo…" },
  { name: "Google Gemini", count: "30 voices", sample: "Charon, Kore, Puck, Despina, Algieba…" },
];

const MUSIC = [
  { icon: Drum, title: "Drum machine", desc: "Ten drums and a piano roll for piano, guitar, bass and synth. Set the tempo, mute tracks, then use the loop under your voice." },
  { icon: Wand2, title: "AI Beats", desc: "Describe the mood, like \"calm and light for a hold message\", and AI writes the pattern into the drum machine for you to adjust." },
  { icon: Link2, title: "Your own music", desc: "Upload a music file or paste a link, or pick a track already in your library." },
];

const STEPS = [
  { title: "Make the voice", desc: "Record it, upload it, or type a script for an AI voice." },
  { title: "Add music", desc: "Build a beat, let AI Beats write one, or bring your own track." },
  { title: "Mix it", desc: "Set the voice and music levels, a lead-in and looping, then preview." },
  { title: "Save and use it", desc: "Save a WAV to your library, label what it's for, and mark it live." },
];

const USES = [
  { icon: Headphones, title: "Main greeting", desc: "\"Thanks for calling Summit Roofing. We're glad you called.\"" },
  { icon: ListOrdered, title: "Phone menus", desc: "\"For sales, press 1. For service, press 2. For billing, press 3.\"" },
  { icon: Hash, title: "Extension prompts", desc: "\"If you know your party's extension, dial it at any time.\"" },
  { icon: Clock, title: "After-hours messages", desc: "\"Our office is open 8 to 5, Monday to Friday. Leave a message and we'll call you back.\"" },
  { icon: Music, title: "Hold messages", desc: "Short announcements over music while callers wait to be transferred." },
  { icon: Voicemail, title: "Voicemail greetings", desc: "A clear, friendly greeting for each team member or department." },
];

const LIBRARY = [
  { icon: LayoutGrid, label: "Cards" }, { icon: FileAudio, label: "List" }, { icon: TableIcon, label: "Table" },
  { icon: SquareKanban, label: "Kanban" }, { icon: CalendarDays, label: "Calendar" },
];

const COMPARE = [
  { feature: "Ready in minutes", cells: [true, "Days to weeks", true] },
  { feature: "Professional voices", cells: ["Dozens of AI voices, or yours", true, "Your own voice only"] },
  { feature: "Change a word and redo it", cells: ["Edit the script and generate again", "New session or fee", "Record it again"] },
  { feature: "Background music", cells: ["Drum machine, AI Beats or upload", "Often extra", false] },
  { feature: "Balanced levels and lead-in", cells: [true, true, false] },
  { feature: "Organized library with statuses", cells: [true, false, false] },
  { feature: "Cost", cells: ["Included with your Redial account", "Per script or per session", "Free"] },
];

const FAQ = FAQ_TOPICS.find((t) => t.id === "studio")?.items ?? [];

export default function RecordingStudioPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_32rem] lg:gap-16">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Redial Recording Studio</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Studio-quality greetings in minutes.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Make the greetings, phone menus, extension prompts and hold messages your callers hear. Record your voice, upload a file, or pick an AI voice, then add music and save it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/studio" />}>Open the Studio <ArrowRight /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#how" />}>How it works</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Included with your Redial account. AI voices from OpenAI, xAI and Google Gemini.</p>
        </div>
        <StudioArt />
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="The voice" title="Three ways to make the voice." sub="Use whichever fits: your own voice, a recording you already have, or an AI voice that reads your script." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {VOICE_WAYS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-background p-6">
                <Icon className="size-5" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {ENGINES.map((e) => (
              <div key={e.name} className="flex items-start gap-3 rounded-2xl border bg-background p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"><AudioLines className="size-4" /></span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{e.name} <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">{e.count}</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">{e.sample}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Voice counts as of today. Each provider adds and retires voices over time.</p>
        </div>
      </section>

      <FeatureGrid eyebrow="The music" title="Put music under your message." items={MUSIC} muted={false} />

      <StepsSection id="how" eyebrow="How it works" title="From script to finished greeting." steps={STEPS} />

      <FeatureGrid eyebrow="Built for phone systems" title="Every recording your phone line needs." items={USES} />

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHead eyebrow="Your library" title="Every recording in one place." sub="See your recordings as cards, a list, a table, a kanban board by status, or a calendar. Label each one, mark it draft, in review, approved or live, and archive what you no longer need." />
            <div className="mt-6 flex flex-wrap gap-2">
              {LIBRARY.map(({ icon: Icon, label }) => <span key={label} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"><Icon className="size-4" />{label}</span>)}
            </div>
          </div>
          <div className="space-y-3">
            {[
              { name: "Main greeting", meta: "Greeting · 0:12", status: "Live", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
              { name: "Sales and service menu", meta: "Phone menu · 0:18", status: "Approved", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
              { name: "After hours", meta: "Greeting · 0:15", status: "In review", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
              { name: "Hold music with update", meta: "Hold message · 0:45", status: "Draft", tone: "bg-muted text-muted-foreground" },
            ].map((r) => (
              <div key={r.name} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Volume2 className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.meta}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.tone}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Compare" title="Faster than a voice studio. Better than your phone's recorder." sub="How the Recording Studio compares with hiring a voice studio and with recording a greeting on your phone." />
          <div className="mt-10">
            <CompareTable caption="Redial Recording Studio compared with a voice studio and recording on your phone" columns={["Redial Recording Studio", "Hiring a voice studio", "Recording on your phone"]} rows={COMPARE} />
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-2">
          {[
            { icon: PhoneForwarded, title: "Redial Business Phone", desc: "Desk phones, extensions and an AI receptionist, with greetings from the studio.", href: "/business-phone" },
            { icon: AudioLines, title: "Redial for business", desc: "Your AI assistant on the business number you already have.", href: "/redial/business" },
          ].map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href} className="rounded-2xl border p-6 transition-colors hover:bg-muted/40">
              <Icon className="size-5" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <FaqSection items={FAQ} title="Recording Studio questions" />
      <FinalCta title="Sound like a big company on the first ring." sub="Make your greeting and phone menu today. It takes a few minutes." business />
    </>
  );
}
