"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { formatDuration } from "@/lib/format";

// Recordings shared with you, in the shared list layout. Read-only: a click opens
// the recording at /shared/[id], so there are no checkboxes or bulk actions.

export type SharedRow = { recording_id: string; title: string; created_at: string; duration_sec: number; shared_by: string; shared_at: string };

const WEEK = 7 * 24 * 3600 * 1000;

export function SharedList({ rows }: { rows: SharedRow[] }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  return (
    <CollectionView<SharedRow>
      items={rows} getId={(r) => r.recording_id} title={(r) => r.title} noun={["recording", "recordings"]} storageKey="shared-with-me" defaultView="list"
      empty="Nothing shared with you yet. When someone shares a recording with your email, it shows up here."
      subtitle={(r) => `From ${r.shared_by}${r.duration_sec ? ` · ${formatDuration(r.duration_sec)}` : ""}`}
      media={() => <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><AudioLines className="size-4" /></span>}
      meta={(r) => <LocalDate iso={r.created_at} short />}
      searchText={(r) => `${r.title} ${r.shared_by}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "week", label: "Shared this week", test: (r) => now - new Date(r.shared_at).getTime() < WEEK },
      ]}
      date={(r) => r.created_at}
      columns={[
        { id: "title", label: "Recording", sort: (r) => r.title.toLowerCase(), cell: (r) => <span className="font-medium">{r.title}</span> },
        { id: "from", label: "Shared by", sort: (r) => r.shared_by.toLowerCase(), cell: (r) => <span className="text-muted-foreground">{r.shared_by}</span> },
        { id: "length", label: "Length", sort: (r) => r.duration_sec, cell: (r) => <span className="text-muted-foreground tabular-nums">{r.duration_sec ? formatDuration(r.duration_sec) : "—"}</span> },
        { id: "recorded", label: "Recorded", sort: (r) => r.created_at, cell: (r) => <span className="text-muted-foreground"><LocalDate iso={r.created_at} short /></span> },
        { id: "shared", label: "Shared", sort: (r) => r.shared_at, cell: (r) => <span className="text-muted-foreground"><LocalDate iso={r.shared_at} short /></span> },
      ]}
      onOpen={(r) => router.push(`/shared/${r.recording_id}`)}
    />
  );
}
