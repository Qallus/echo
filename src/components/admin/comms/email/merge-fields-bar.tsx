"use client";

import { useState } from "react";
import { Braces, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MERGE_FIELDS } from "@/lib/comms/blocks";

// One sliding row of merge fields above the canvas, plus "All fields" in a
// bottom sheet. Clicking a field puts it where the cursor is (or in the
// selected block); fields can also be dragged into any text box.
export function MergeFieldsBar({ onInsert, children }: { onInsert: (token: string) => void; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const chip = (m: (typeof MERGE_FIELDS)[number], big = false) => (
    <button key={m.token} type="button" title={`${m.label}: click to insert, or drag into a text box`} draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", m.token)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onInsert(m.token); setOpen(false); }}
      className={big
        ? "flex flex-col items-start rounded-lg border px-3 py-2 text-left hover:bg-muted"
        : "flex shrink-0 items-center gap-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"}>
      {big ? <><span className="text-sm font-medium">{m.label}</span><span className="font-mono text-[11px] text-muted-foreground">{m.token}</span></>
        : <><Copy className="size-3" aria-hidden />{m.token}</>}
    </button>
  );
  return (
    <div className="flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fields</span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:thin]">{MERGE_FIELDS.map((m) => chip(m))}</div>
      <Button size="sm" variant="outline" className="shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(true)}><Braces /> All fields</Button>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto p-5">
          <SheetTitle>Merge fields</SheetTitle>
          <SheetDescription>Filled in for each person when the email is sent. Pick one to insert it.</SheetDescription>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{MERGE_FIELDS.map((m) => chip(m, true))}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
