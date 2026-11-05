import Link from "next/link";
import { Users } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/lib/data";
import { formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Shared with me · Echo" };

type Row = { recording_id: string; title: string; created_at: string; duration_sec: number; shared_by: string; shared_at: string };

// Recordings other people shared with your email address. Read-only.
export default async function SharedWithMePage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shared_with_me");
  const rows = (data ?? []) as Row[];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shared with me</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recordings other people shared with your email address. You can read them, but not change them.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing shared with you yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When someone shares a recording with your email, it shows up here.</p>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.recording_id}>
              <Link href={`/shared/${r.recording_id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">From {r.shared_by} · <LocalDate iso={r.created_at} />{r.duration_sec ? ` · ${formatDuration(r.duration_sec)}` : ""}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
