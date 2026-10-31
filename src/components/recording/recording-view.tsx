"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowRightLeft, Briefcase, ChevronRight, Download, FileText, Lock, MoreHorizontal, Share2, Sparkles, ThumbsDown, ThumbsUp, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusTag } from "@/components/recordings-table";
import { AskPanel } from "@/components/recording/ask-panel";
import { AudioBar } from "@/components/recording/audio-bar";
import { TranscribeButton, Transcribing, TranscriptionFailed } from "@/components/recording/transcribe";
import { MindMap } from "@/components/recording/mind-map";
import { LocalDate } from "@/components/local-date";
import { moveRecordings, toggleActionItem } from "@/lib/actions";
import { formatClock, formatDuration, spaceLabel } from "@/lib/format";
import type { Recording, RecordingDetail, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  detail: RecordingDetail; list: Recording[]; space: Workspace; moveTargets: Workspace[];
  audioSrc: string | null; processingError: string | null;
};

export function RecordingView({ detail, list, space, moveTargets, audioSrc, processingError }: Props) {
  const { recording: r, segments, highlights, summary } = detail;
  const [moving, startMove] = useTransition();
  const [moveError, setMoveError] = useState<string>();
  const move = (to: Workspace) =>
    startMove(async () => {
      const res = await moveRecordings([r.id], to.id);
      setMoveError(res.errors[0]);
    });
  const [askOpen, setAskOpen] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  return (
    <div className="flex h-[calc(100svh-3rem)] md:h-svh">
      {/* File list column */}
      <nav className="hidden w-64 shrink-0 overflow-y-auto border-r xl:block">
        {list.map((f) => (
          <Link key={f.id} href={`/recordings/${f.id}`}
            className={cn("block border-b px-4 py-3 hover:bg-muted/60", f.id === r.id && "bg-muted")}>
            <div className="truncate text-sm font-medium">{f.title}</div>
            <div className="text-xs text-muted-foreground"><LocalDate iso={f.createdAt} short /> · {formatDuration(f.durationSec)}</div>
            <StatusTag status={f.status} />
          </Link>
        ))}
      </nav>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
          <Link href={`/library/space/${space.id}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            {space.isPersonal ? <Lock className="size-3.5" /> : <Briefcase className="size-3.5" />}
            {spaceLabel(space)}
          </Link>
          <ChevronRight className="size-4 text-muted-foreground" />
          <span className="truncate font-medium">{r.title}</span>
          <div className="ml-auto flex items-center gap-1">
            {moveError && <span className="mr-2 text-xs text-destructive">{moveError}</span>}
            {moveTargets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" disabled={moving} />}>
                  <ArrowRightLeft /> {moving ? "Moving…" : "Move"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Move to</DropdownMenuLabel>
                    {moveTargets.map((w) => (
                      <DropdownMenuItem key={w.id} onClick={() => move(w)}>
                        {w.isPersonal ? <Lock /> : <Briefcase />}
                        <span className="truncate">{w.isPersonal ? "Personal (only you)" : `${w.name} (team)`}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm"><Share2 /> Share</Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Export" />}><Download /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><FileText /> Export PDF</DropdownMenuItem>
                <DropdownMenuItem><FileText /> Export transcript (.txt)</DropdownMenuItem>
                <DropdownMenuItem><FileText /> Publish as web page</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" aria-label="More"><MoreHorizontal /></Button>
            {!askOpen && <Button variant="ghost" size="sm" onClick={() => setAskOpen(true)}><Sparkles /> Ask Echo</Button>}
          </div>
        </header>

        <Tabs defaultValue={summary && r.status !== "processing" ? "summary" : "transcript"} className="min-h-0 flex-1 gap-0">
          <div className="border-b px-6 py-2">
            <TabsList variant="line">
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="highlights">Highlights</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-8">
              <TabsContent value="transcript" className="space-y-5">
                {r.status === "processing" ? <Transcribing /> : r.status === "failed" && !segments.length ? (
                  <TranscriptionFailed recordingId={r.id} message={processingError} />
                ) : segments.length ? segments.map((s, i) => (
                  <div key={i} className="grid grid-cols-[56px_1fr] gap-3">
                    <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{formatClock(s.startSec)}</span>
                    <div>
                      <div className="text-sm font-medium">{s.speaker}</div>
                      <p className="text-sm leading-relaxed text-foreground/90">{s.text}</p>
                    </div>
                  </div>
                )) : audioSrc ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground">
                    No transcript yet
                    <TranscribeButton recordingId={r.id} />
                  </div>
                ) : <Empty label="No transcript yet. This recording has no audio to transcribe." />}
              </TabsContent>

              <TabsContent value="highlights" className="space-y-3">
                {highlights.length ? highlights.map((h, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border p-3 text-sm">
                    <span className="tabular-nums text-muted-foreground">{formatClock(h.startSec)}</span>
                    <span>{h.text}</span>
                  </div>
                )) : <Empty label="No highlights yet" />}
              </TabsContent>

              <TabsContent value="summary">
                {summary ? (
                  <div className="space-y-10">
                    <p className="text-xs text-muted-foreground">{summary.template} · generated with {summary.model}</p>
                    <Section title="Overview"><p className="leading-relaxed">{summary.overview}</p></Section>
                    <Section title="Key points">
                      <ul className="list-disc space-y-1.5 pl-5">{summary.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
                    </Section>
                    <Section title="Action items">
                      <div className="space-y-6">
                        {summary.actionGroups.map((g) => (
                          <div key={g.owner} className="space-y-2">
                            <div className="font-medium">@{g.owner} {g.role && <span className="font-normal text-muted-foreground">({g.role})</span>}</div>
                            {g.items.map((it) => {
                              const checked = done[it.id] ?? it.done;
                              return (
                                <label key={it.id} className="flex cursor-pointer items-start gap-3">
                                  <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => {
                                    setDone((d) => ({ ...d, [it.id]: !!v }));
                                    toggleActionItem(it.id, !!v).catch(() => setDone((d) => ({ ...d, [it.id]: !v })));
                                  }} />
                                  <span className={cn(checked && "text-muted-foreground line-through")}>{it.text}</span>
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </Section>
                    <Section title="Mind map">
                      <div className="rounded-xl border p-4"><MindMap {...summary.mindMap} /></div>
                    </Section>
                    <div className="flex gap-2 border-t pt-6">
                      <Button variant={vote === "up" ? "secondary" : "outline"} size="sm" onClick={() => setVote("up")}><ThumbsUp /> Good</Button>
                      <Button variant={vote === "down" ? "secondary" : "outline"} size="sm" onClick={() => setVote("down")}><ThumbsDown /> Bad</Button>
                    </div>
                  </div>
                ) : <Empty label="No summary yet" action="Generate summary" />}
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <AudioBar duration={r.durationSec} src={audioSrc} />
      </div>

      {askOpen && <AskPanel recordingId={r.id} onClose={() => setAskOpen(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Empty({ label, action }: { label: string; action?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground">
      {label}
      {action && <Button size="sm"><Wand2 /> {action}</Button>}
    </div>
  );
}
