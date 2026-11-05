import { Check, Flag, StickyNote } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { formatClock, formatDuration } from "@/lib/format";
import type { SharedRecording } from "@/lib/share";
import { cn } from "@/lib/utils";

// A shared recording, read-only: what a public link shows and what someone a
// recording was shared with sees. Only the parts that were shared are present.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function SharedView({ r, audioSrc }: { r: SharedRecording; audioSrc: string | null }) {
  const items = r.actionItems ?? [];
  return (
    <article className="mx-auto w-full max-w-3xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{r.summary?.title || r.title}</h1>
        <p className="text-sm text-muted-foreground">
          {r.owner ? `Shared by ${r.owner} · ` : ""}<LocalDate iso={r.createdAt} />{r.durationSec ? ` · ${formatDuration(r.durationSec)}` : ""}
        </p>
        {audioSrc && <audio controls preload="metadata" src={audioSrc} className="mt-4 w-full" />}
      </header>

      {r.summary && (
        <Section title="Summary">
          {r.summary.overview && <p className="leading-relaxed">{r.summary.overview}</p>}
          {r.summary.keyPoints.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">{r.summary.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          )}
          {!r.summary.overview && !r.summary.keyPoints.length && <p className="text-sm text-muted-foreground">No summary yet.</p>}
        </Section>
      )}

      {items.length > 0 && (
        <Section title="Action items">
          <ul className="space-y-2 text-sm">
            {items.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border", a.done && "bg-foreground text-background")}>{a.done && <Check className="size-3" />}</span>
                <span className={cn(a.done && "text-muted-foreground line-through")}>{a.text}{a.owner && <span className="text-muted-foreground"> · {a.owner}</span>}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.highlights && r.highlights.length > 0 && (
        <Section title="Highlights">
          <ul className="space-y-2 text-sm">
            {r.highlights.map((h, i) => (
              <li key={i} className="flex gap-3 rounded-lg border p-3">
                {h.kind === "flag" ? <Flag className="mt-0.5 size-4 shrink-0" /> : <StickyNote className="mt-0.5 size-4 shrink-0" />}
                <span className="min-w-0">
                  <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">{formatClock(h.startSec)}</span>
                  {h.title && <span className="font-medium">{h.title}: </span>}{h.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.transcript && (
        <Section title="Transcript">
          {r.transcript.length ? (
            <div className="space-y-4 text-sm leading-relaxed">
              {r.transcript.map((s, i) => (
                <p key={i}>
                  <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">{formatClock(s.startSec)}</span>
                  <span className="font-medium">{s.speaker}:</span> {s.text}
                </p>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No transcript yet.</p>}
        </Section>
      )}
    </article>
  );
}
