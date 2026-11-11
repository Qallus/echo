"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaStudio } from "@/components/studio/media-studio";
import { StudioLibrary } from "@/components/studio/studio-library";
import type { StudioAudio } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// Recording Studio: the library of recordings and the studio that makes them.
export function StudioView({ items, initialTab }: { items: StudioAudio[]; initialTab: "library" | "studio" }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const refresh = () => router.refresh();
  return (
    <div className="space-y-6">
      <div className="flex w-full gap-1 rounded-lg border bg-muted/40 p-1 sm:w-fit" role="tablist" aria-label="Studio">
        {(["library", "studio"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn("flex-1 rounded-md px-4 py-2 text-sm font-medium sm:flex-none", tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t === "library" ? `Library${items.length ? ` (${items.filter((a) => !a.archived_at).length})` : ""}` : "Studio"}
          </button>
        ))}
      </div>
      {/* The studio stays mounted so a voiceover or beat in progress isn't lost when checking the library. */}
      <div hidden={tab !== "library"}><StudioLibrary items={items} onChanged={refresh} /></div>
      <div hidden={tab !== "studio"}><MediaStudio library={items} onSaved={refresh} /></div>
    </div>
  );
}
