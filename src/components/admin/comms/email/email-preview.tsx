"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// An email as the recipient sees it, in a sandboxed frame (no scripts, no
// navigation), at desktop or phone width.
export function EmailPreview({ html, title = "Preview", height = 640, note }: { html: string; title?: string; height?: number; note?: string }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const doc = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0">${html}</body></html>`;
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}{note && <span className="ml-1 font-normal normal-case tracking-normal">· {note}</span>}</h3>
        <div className="flex rounded-lg border p-0.5">
          <Button size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-label="Desktop preview" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><Monitor /></Button>
          <Button size="icon-sm" variant={device === "phone" ? "secondary" : "ghost"} aria-label="Phone preview" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}><Smartphone /></Button>
        </div>
      </div>
      <div className="flex justify-center rounded-xl border bg-muted/30 p-2">
        <iframe title={title} sandbox="" srcDoc={doc} style={{ height }} className={cn("rounded-lg bg-white", device === "phone" ? "w-[380px] max-w-full" : "w-full")} />
      </div>
    </section>
  );
}
