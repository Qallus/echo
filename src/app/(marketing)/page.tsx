import Link from "next/link";
import {
  Briefcase, FileAudio, Lock, MessageSquareText, Mic, PictureInPicture2, Plug, Search, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppBadges } from "@/components/marketing/app-badges";
import { HeroDemo } from "@/components/marketing/hero-demo/hero-demo";

export const metadata = {
  title: "Echo · Record, transcribe and search every call and meeting",
  description:
    "Record meetings and calls in your browser, take notes as you talk, and get speaker-labelled transcripts automatically. Share with your team or keep it private.",
};

const FEATURES = [
  { icon: Mic, title: "Record in the browser", desc: "One click to record a meeting or call, from your microphone or a shared Meet, Zoom or Teams tab." },
  { icon: PictureInPicture2, title: "Notes that stay on top", desc: "Pop the recorder out over your meeting. Notes and flags are saved at the exact moment they happened." },
  { icon: MessageSquareText, title: "Transcripts with speakers", desc: "Every recording is transcribed automatically, labelled by speaker and time." },
  { icon: Search, title: "Search everything", desc: "Find any word across titles, transcripts and summaries, and jump straight to the recording." },
  { icon: Sparkles, title: "Ask Echo", desc: "Ask Claude, ChatGPT, Gemini or Grok about one recording or your whole library." },
  { icon: FileAudio, title: "Bring your audio", desc: "Drag audio files from your computer anywhere onto Echo. MP3, M4A, WAV and more." },
];

const STEPS = [
  { n: "1", title: "Record or drop a file", desc: "Choose Business or Personal first, so every recording lands in the right place." },
  { n: "2", title: "Echo transcribes it", desc: "A speaker-labelled transcript appears a minute or two later, ready to read and search." },
  { n: "3", title: "Find, ask and share", desc: "Search across everything, ask questions in plain words, and keep your team in the loop." },
];

const FAQ = [
  { q: "Who can hear my recordings?", a: "Recordings in your Personal workspace are only yours. Recordings in a Business workspace are shared with the people you invite to it. You can move a recording between them at any time, and its audio moves with it." },
  { q: "Where is my audio stored?", a: "In a private storage bucket. Every request is checked against your workspace membership, so files are only reachable by people who belong to that workspace." },
  { q: "How long can a recording be?", a: "Browser recordings are saved in a compact format, so about an hour and forty minutes fits in one transcription. Uploads can be up to 50 MB each." },
  { q: "Which browsers work?", a: "Recording works in Chrome, Edge, Firefox and Safari. The always-on-top pop-out recorder needs Chrome or Edge on a computer." },
  { q: "Can I use Echo from Claude?", a: "Yes. Echo includes a Claude connector, so you can search recordings, add notes and manage your backlog from Claude on the web, on your phone, or in Claude Code." },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        <p className="mb-4 text-sm text-muted-foreground">Recordings, transcripts and summaries in one place</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Every call and meeting, captured and searchable.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-balance text-muted-foreground">
          Record in your browser, take notes as you talk, and get speaker-labelled transcripts automatically.
          Share with your team or keep it private.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>Start free trial</Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/#how" />}>See how it works</Button>
        </div>
        <AppBadges source="home-hero" className="mt-6 justify-center" />
      </section>

      <section className="px-4 pb-20 sm:px-6"><HeroDemo /></section>

      <section id="features" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Everything from the conversation, kept</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Echo handles the recording and the paperwork, so you can pay attention to the people.</p>
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

      <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="space-y-2">
              <span className="flex size-8 items-center justify-center rounded-full border text-sm font-medium">{s.n}</span>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
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
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Start capturing your conversations</h2>
        <p className="mt-2 text-muted-foreground">Create an account in a minute. Personal or Business, your choice.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>Start free trial</Button>
          <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/pricing" />}>See pricing</Button>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">Echo for your phone</p>
        <AppBadges source="home-cta" className="mt-3 justify-center" />
      </section>
    </>
  );
}
