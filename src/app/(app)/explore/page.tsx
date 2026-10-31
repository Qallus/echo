import Link from "next/link";
import {
  Bot, Briefcase, FileAudio, LayoutTemplate, MessageSquareText, Mic, Phone, Plug, Share2, Sparkles, Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Explore · Echo" };

type Feature = { icon: typeof Mic; title: string; desc: string; href?: string; live: boolean };

const FEATURES: Feature[] = [
  { icon: Mic, title: "Record meetings and calls", desc: "Record in the browser with notes and flags, or pop the panel out over Zoom and Meet.", live: true },
  { icon: FileAudio, title: "Upload audio", desc: "Drop audio files anywhere in Echo.", live: true },
  { icon: MessageSquareText, title: "Transcription", desc: "Speaker-labelled transcripts, started automatically after every recording.", live: true },
  { icon: Sparkles, title: "Ask Echo", desc: "Ask Claude, ChatGPT, Grok or Kimi about one recording or your whole library.", href: "/ask", live: true },
  { icon: Briefcase, title: "Business and Personal", desc: "Share recordings with your team, keep others private, move between them.", href: "/team", live: true },
  { icon: Plug, title: "Claude connector (MCP)", desc: "Work with your recordings and backlog from Claude on your phone or in Claude Code.", href: "/developer", live: true },
  { icon: LayoutTemplate, title: "Summaries and templates", desc: "Overviews, decisions and action items, structured by template.", href: "/templates", live: false },
  { icon: Share2, title: "Share", desc: "Share a recording by link or invite, choosing audio, transcript, highlights and summary.", live: false },
  { icon: Workflow, title: "AutoFlow", desc: "Rules that summarize, file and route new recordings automatically.", live: false },
  { icon: Bot, title: "AI agents", desc: "Agents that act on every call: follow-ups, tasks and CRM updates.", live: false },
  { icon: Phone, title: "Phone calls and SMS", desc: "Record and send from your Echo phone numbers.", live: false },
];

export default function ExplorePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <p className="text-sm text-muted-foreground">What Echo does today, and what&apos;s coming.</p>
      </div>
      {[true, false].map((live) => (
        <section key={String(live)} className="space-y-4">
          <h2 className="text-xl font-semibold">{live ? "Available now" : "Coming next"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.filter((f) => f.live === live).map(({ icon: Icon, title, desc, href }) => {
              const card = (
                <Card className={href ? "h-full transition-colors hover:bg-muted/50" : "h-full"}>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Icon className="size-5" />
                      {!live && <Badge variant="outline">Coming</Badge>}
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
              return href ? <Link key={title} href={href}>{card}</Link> : <div key={title}>{card}</div>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
