"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowRightLeft, Briefcase, ChevronRight, Download, FileText, Flag, Lock, MoreHorizontal, Palette, Plus, Share2, Sparkles, StickyNote, ThumbsDown, ThumbsUp, Wand2,
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
import { TemplatePicker } from "@/components/recording/template-picker";
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
  // Ask Echo: a side panel open by default from lg up; below lg a full-screen
  // overlay opened on demand (separate state, so server and client markup match).
  const [askOpen, setAskOpen] = useState(true);
  const [mobileAsk, setMobileAsk] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  return (
    <div className="flex h-[calc(100svh-3rem-var(--bottom-nav))] md:h-svh">
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
        <header className="flex items-center gap-2 border-b px-3 py-2.5 text-sm sm:px-4">
          <Link href={`/library/space/${space.id}`} aria-label={spaceLabel(space)} className="flex shrink-0 items-center gap-1.5 text-muted-foreground hover:text-foreground">
            {space.isPersonal ? <Lock className="size-3.5" /> : <Briefcase className="size-3.5" />}
            <span className="hidden sm:inline">{spaceLabel(space)}</span>
          </Link>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">{r.title}</span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {moveError && <span className="mr-2 text-xs text-destructive">{moveError}</span>}
            {moveTargets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" disabled={moving} aria-label="Move" />}>
                  <ArrowRightLeft /> <span className="hidden sm:inline">{moving ? "Moving…" : "Move"}</span>
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
            <Button variant="outline" size="sm" aria-label="Share"><Share2 /> <span className="hidden sm:inline">Share</span></Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Export" />}><Download /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link href={`/recordings/${r.id}/report`} />}><FileText /> Branded summary (PDF)</DropdownMenuItem>
                <DropdownMenuItem><FileText /> Export transcript (.txt)</DropdownMenuItem>
                <DropdownMenuItem><FileText /> Publish as web page</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon-sm" aria-label="More" className="hidden sm:inline-flex"><MoreHorizontal /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Ask Echo" className="lg:hidden" onClick={() => setMobileAsk(true)}><Sparkles /></Button>
            {!askOpen && <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => setAskOpen(true)}><Sparkles /> Ask Echo</Button>}
          </div>
        </header>

        <Tabs defaultValue={summary && r.status !== "processing" ? "summary" : "transcript"} className="min-h-0 flex-1 gap-0">
          <div className="flex items-center gap-2 border-b px-4 py-2 sm:px-6">
            <TabsList variant="line">
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="highlights">Highlights</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>
            {segments.length > 0 && (
              <Button variant="secondary" size="icon-sm" aria-label="Choose a template" title="Choose a template"
                onClick={() => setPickerOpen(true)}><Plus /></Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
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

              <TabsContent value="highlights" className="space-y-8">
                {highlights.length ? (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Recording highlights</h2>
                    {highlights.map((h, i) => (
                      <article key={h.id ?? i} className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[5.5rem_1fr] sm:gap-5">
                        <span className="flex items-start gap-1.5 pt-1 text-sm tabular-nums text-muted-foreground">
                          {h.kind === "ai" ? <Sparkles className="mt-0.5 size-3.5 shrink-0" /> : h.kind === "flag" ? <Flag className="mt-0.5 size-3.5 shrink-0" /> : <StickyNote className="mt-0.5 size-3.5 shrink-0" />}
                          {formatClock(h.startSec)}
                        </span>
                        <div className="space-y-2">
                          <p className={cn(h.kind === "ai" ? "text-lg leading-snug font-medium" : "text-base")}>{h.title || h.text}</p>
                          {!!h.bullets?.length && (
                            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/85">{h.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                          )}
                          {h.kind !== "ai" && <p className="text-xs text-muted-foreground">{h.kind === "flag" ? "Flagged during the recording" : "Your note"}</p>}
                        </div>
                      </article>
                    ))}
                  </>
                ) : segments.length ? (
                  <Empty label="No highlights yet. Pick a template to generate them." action="Generate highlights" onAction={() => setPickerOpen(true)} />
                ) : <Empty label="No highlights yet" />}
              </TabsContent>

              <TabsContent value="summary">
                {summary ? (
                  <div className="space-y-10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{summary.template}{summary.model && ` · ${summary.model}`}{summary.language && summary.language !== "English" && ` · ${summary.language}`}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/recordings/${r.id}/report`} />}><Palette /> Branded summary</Button>
                        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}><Wand2 /> Change template</Button>
                      </div>
                    </div>
                    <Section title="Overview"><p className="leading-relaxed">{summary.overview}</p></Section>
                    {summary.sections?.filter((s) => s.bullets.length).map((s) => (
                      <Section key={s.heading} title={s.heading}>
                        <ul className="list-disc space-y-1.5 pl-5">{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                      </Section>
                    ))}
                    {!summary.sections?.length && (
                      <Section title="Key points">
                        <ul className="list-disc space-y-1.5 pl-5">{summary.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
                      </Section>
                    )}
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
                ) : segments.length ? (
                  <Empty label="No summary yet" action="Generate summary" onAction={() => setPickerOpen(true)} />
                ) : <Empty label="No summary yet. Transcribe the recording first." />}
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <AudioBar duration={r.durationSec} src={audioSrc} />
      </div>

      <TemplatePicker recordingId={r.id} open={pickerOpen} onOpenChange={setPickerOpen} current={summary?.template} />

      {(askOpen || mobileAsk) && (
        <AskPanel
          recordingId={r.id}
          onClose={() => { setAskOpen(false); setMobileAsk(false); }}
          className={mobileAsk ? "fixed inset-0 z-50 w-full border-l-0 lg:static lg:z-auto lg:w-96 lg:border-l" : "hidden lg:flex"}
        />
      )}
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

function Empty({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center text-sm text-muted-foreground">
      {label}
      {action && <Button size="sm" onClick={onAction}><Wand2 /> {action}</Button>}
    </div>
  );
}
