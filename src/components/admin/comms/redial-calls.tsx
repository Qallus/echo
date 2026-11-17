import Link from "next/link";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { LocalDate } from "@/components/local-date";
import { createClient } from "@/lib/supabase/server";

// Admin -> Communications -> Calls: recent calls on the Redial lines this
// staff member can see (their own lines and lines shared with them; RLS
// decides), each linking to the full call in Calls.

type Row = {
  id: string; line_id: string; direction?: string; from_number: string | null; to_number?: string | null; caller_name: string | null; caller_id_name: string | null;
  status: string; duration_seconds: number | null; cost_cents?: number | null; started_at: string; recording_id?: string | null;
};
const pretty = (n: string | null | undefined) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "Unknown");
const mins = (s: number | null) => (!s ? "" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

export async function RedialCalls() {
  const supabase = await createClient();
  const base = "id, line_id, from_number, caller_name, caller_id_name, status, duration_seconds, started_at";
  let res = await supabase.from("redial_calls").select(`${base}, direction, to_number, cost_cents, recording_id`).order("started_at", { ascending: false }).limit(25);
  if (res.error) res = await supabase.from("redial_calls").select(base).order("started_at", { ascending: false }).limit(25) as typeof res;
  const rows = (res.data ?? []) as Row[];
  const { data: lines } = await supabase.from("redial_lines").select("id, label, number");
  if (!lines?.length) return null;
  const lineName = (id: string) => lines.find((l) => l.id === id)?.label ?? "Line";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Redial lines</h2>
          <p className="text-sm text-muted-foreground">Calls in and out of {lines.map((l) => `${l.label} ${pretty(l.number)}`).join(", ")}, including desk phones. Open one for the recording, transcript, summary and actions.</p>
        </div>
        <Link href="/calls" className="text-sm font-medium underline-offset-4 hover:underline">All calls</Link>
      </div>
      {rows.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No calls on your Redial lines yet.</p> : (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {rows.map((c) => {
            const out = c.direction === "outbound";
            const who = out ? pretty(c.to_number) : c.caller_name || c.caller_id_name || pretty(c.from_number);
            return (
              <li key={c.id}>
                <Link href={`/calls?line=${c.line_id}&call=${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-muted/50">
                  {out ? <PhoneOutgoing className="size-4 text-muted-foreground" aria-label="Outgoing" /> : <PhoneIncoming className="size-4 text-muted-foreground" aria-label="Incoming" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{who}</span>
                  <span className="text-xs text-muted-foreground">{lineName(c.line_id)}</span>
                  {c.duration_seconds ? <span className="text-xs tabular-nums text-muted-foreground">{mins(c.duration_seconds)}</span> : null}
                  {c.cost_cents != null && <span className="text-xs tabular-nums text-muted-foreground">${(Number(c.cost_cents) / 100).toFixed(3)}</span>}
                  {c.recording_id && <span className="rounded-full border px-1.5 text-[10px] text-muted-foreground">Recorded</span>}
                  <span className="text-xs text-muted-foreground"><LocalDate iso={c.started_at} short /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
