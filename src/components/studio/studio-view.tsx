"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaStudio } from "@/components/studio/media-studio";
import { StudioLibrary } from "@/components/studio/studio-library";
import { QuickGreeting, type GreetingPrefill } from "@/components/studio/quick-greeting";
import type { StudioAudio } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// Recording Studio: the library of recordings and the studio that makes them.
export function StudioView({ items, initialTab, prefill }: { items: StudioAudio[]; initialTab: "library" | "studio"; prefill?: GreetingPrefill }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const refresh = () => router.refresh();
  return (
    <div className="space-y-6">
      <div className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-fit" role="tablist" aria-label="Studio">
        {(["library", "studio"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-md px-4 py-2 text-sm font-medium sm:flex-none", tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t === "library" ? `Library${items.length ? ` (${items.filter((a) => !a.archived_at).length})` : ""}` : "Create"}
          </button>
        ))}
      </div>
      {/* The studio stays mounted so a voiceover or beat in progress isn't lost when checking the library. */}
      <div hidden={tab !== "library"}><StudioLibrary items={items} onChanged={refresh} /></div>
      <div hidden={tab !== "studio"} className="space-y-6">
        <QuickGreeting prefill={prefill} onSaved={refresh} />
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
            <span>
              <span className="block text-lg font-semibold">Record your own voice, upload, or add music</span>
              <span className="block text-sm text-muted-foreground">The full studio: microphone or file, AI voice with speed, a music bed or drum beat, levels and mixing.</span>
            </span>
            <span className="shrink-0 text-sm text-muted-foreground group-open:hidden">Open</span>
            <span className="hidden shrink-0 text-sm text-muted-foreground group-open:inline">Close</span>
          </summary>
          <div className="border-t p-4 sm:p-6"><MediaStudio library={items} onSaved={refresh} /></div>
        </details>
      </div>
    </div>
  );
}
