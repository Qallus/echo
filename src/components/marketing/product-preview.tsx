import { AudioLines, Flag, Lock, Pause, Square, SquarePen } from "lucide-react";

// A static picture of Echo, drawn in HTML: the in-call panel next to a
// speaker-labelled transcript. Decorative (aria-hidden).
const TRANSCRIPT = [
  { t: "0:00", who: "Speaker A", text: "Thanks for joining. Let's review the launch plan for the new recorder." },
  { t: "0:05", who: "Speaker B", text: "The budget is approved, and design finishes the panel this week." },
  { t: "0:10", who: "Speaker A", text: "Great. Then we ship on Friday and send the announcement on Monday." },
];

export function ProductPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-2xl shadow-black/5">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          <span className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3" /> Personal · Launch plan review</span>
        </div>
        <div className="grid gap-0 md:grid-cols-[1fr_20rem]">
          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex gap-4 border-b pb-3 text-sm">
              <span className="border-b-2 border-foreground pb-3 font-medium">Transcript</span>
              <span className="text-muted-foreground">Highlights</span>
              <span className="text-muted-foreground">Summary</span>
            </div>
            {TRANSCRIPT.map((s) => (
              <div key={s.t} className="grid grid-cols-[44px_1fr] gap-3">
                <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">{s.t}</span>
                <div>
                  <div className="text-sm font-medium">{s.who}</div>
                  <p className="text-sm leading-relaxed text-foreground/80">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t bg-muted/20 p-4 md:border-t-0 md:border-l">
            <div className="flex h-full flex-col rounded-xl border bg-background shadow-sm">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <AudioLines className="size-4" />
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"><Lock className="size-3" /> Personal</span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                <p className="text-base text-muted-foreground">Meeting highlights</p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                  <SquarePen className="size-3.5" /> Jot down key points or ideas instantly
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="w-8 text-muted-foreground tabular-nums">0:06</span> Budget approved</div>
                  <div className="flex gap-2"><span className="w-8 text-muted-foreground tabular-nums">0:11</span><span className="flex items-center gap-1 text-muted-foreground"><Flag className="size-3" /> Flagged moment</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t p-3">
                <span className="flex size-8 items-center justify-center rounded-md border"><Pause className="size-3.5" /></span>
                <span className="flex size-8 items-center justify-center rounded-md border"><Square className="size-3 fill-current" /></span>
                <span className="flex-1 text-center text-xs tabular-nums text-muted-foreground">0:14</span>
                <span className="flex size-8 items-center justify-center rounded-md border"><Flag className="size-3.5" /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
