import Link from "next/link";
import { Briefcase, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/local-date";
import { listRecordings, listWorkspaces } from "@/lib/data";
import { spaceLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Search · Echo" };

type Hit = { recording_id: string; title: string; source: string; created_at: string; match_in: string; snippet: string };

// "…the **budget** is…" from search_recordings -> text with <mark>s.
function Snippet({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <mark key={i} className="rounded bg-amber-200/60 px-0.5 text-foreground dark:bg-amber-500/30">{part.slice(2, -2)}</mark> : part,
  )}</>;
}

const MATCH_LABEL: Record<string, string> = { title: "Title", transcript: "Transcript", summary: "Summary" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 200);
  let hits: Hit[] = [];
  let error: string | null = null;
  const [workspaces, recordings] = await Promise.all([listWorkspaces(), listRecordings()]);
  if (q) {
    const supabase = await createClient();
    const res = await supabase.rpc("search_recordings", { query: q, ws: null, max_results: 50 });
    if (res.error) error = res.error.message;
    else hits = res.data as Hit[];
  }
  const workspaceOf = new Map(recordings.map((r) => [r.id, workspaces.find((w) => w.id === r.workspaceId)]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <form action="/search" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search titles, transcripts and summaries" className="h-10 pl-8" autoFocus aria-label="Search" />
        </div>
        <Button type="submit" className="h-10">Search</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Tip: use quotes for an exact phrase (&ldquo;launch plan&rdquo;) and a minus to exclude a word (budget -draft).
      </p>

      {error && <p className="text-sm text-destructive">Search failed: {error}</p>}
      {q && !error && (
        hits.length ? (
          <ul className="space-y-3">
            <li className="text-sm text-muted-foreground">{hits.length} result{hits.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;</li>
            {hits.map((h) => {
              const ws = workspaceOf.get(h.recording_id);
              return (
                <li key={h.recording_id}>
                  <Link href={`/recordings/${h.recording_id}`} className="block rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{h.title}</span>
                      {ws && workspaces.length > 1 && (
                        <Badge variant="outline" className="text-muted-foreground">{ws.isPersonal ? <Lock /> : <Briefcase />} {spaceLabel(ws)}</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground"><LocalDate iso={h.created_at} short /></span>
                    </div>
                    {h.match_in !== "title" && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="mr-1 text-xs font-medium uppercase">{MATCH_LABEL[h.match_in] ?? h.match_in}</span>
                        <Snippet text={h.snippet} />
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
            No recordings match &ldquo;{q}&rdquo;. Recordings are searchable once transcribed.
          </p>
        )
      )}
    </div>
  );
}
