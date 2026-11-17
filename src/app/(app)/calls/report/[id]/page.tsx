import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/redial/print-button";
import { isUuid, requireUser } from "@/lib/data";
import { CHECK_SIGNALS, RISK_SIGNALS, VERDICT_LABEL, type Verdict } from "@/lib/redial/protection-shared";
import type { Turn } from "@/lib/redial/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Call report · Redial" };

// A screened call written up for reporting a scam: what happened, what Redial
// checked, what the caller said, and where to report it. Print or save as PDF.
// RLS limits it to people who can see the line's calls.

type Row = {
  id: string; line_id: string; direction: string | null; from_number: string | null; caller_id_name: string | null; caller_name: string | null;
  status: string; reason: string | null; purpose: string | null; callback_number: string | null; message: string | null; summary: string | null;
  verdict: Verdict | null; risk_signals: { code: string; detail: string }[] | null; duration_seconds: number | null; started_at: string; recording_id: string | null;
};
const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "No caller ID");
const signalText = (s: { code: string; detail: string }) => (RISK_SIGNALS as Record<string, string>)[s.code] ?? CHECK_SIGNALS[s.code] ?? s.detail;

const WHERE = [
  { who: "Your bank or card company", how: "Call the number on the back of your card right away if any money, card number or account detail was shared." },
  { who: "Local police", how: "Use the non-emergency number. Call 911 if someone is coming to your home or you're in danger." },
  { who: "FBI Internet Crime Complaint Center", how: "ic3.gov", href: "https://www.ic3.gov" },
  { who: "Federal Trade Commission", how: "reportfraud.ftc.gov", href: "https://reportfraud.ftc.gov" },
];

export default async function CallReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("redial_calls")
    .select("id, line_id, direction, from_number, caller_id_name, caller_name, status, reason, purpose, callback_number, message, summary, verdict, risk_signals, duration_seconds, started_at, recording_id")
    .eq("id", id).maybeSingle();
  const c = data as Row | null;
  if (!c) notFound();
  const [{ data: line }, { data: transcripts }, summary] = await Promise.all([
    supabase.from("redial_lines").select("label, number, assistant_name").eq("id", c.line_id).maybeSingle(),
    supabase.rpc("redial_transcripts", { p_line: c.line_id, p_ids: [c.id] }),
    c.recording_id ? supabase.from("summaries").select("overview").eq("recording_id", c.recording_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const turns = (((transcripts ?? []) as { transcript: Turn[] }[])[0]?.transcript ?? []).slice(0, 60);
  const signals = (c.risk_signals ?? []).filter((s) => !s.code.startsWith("code_word_try"));
  const when = new Date(c.started_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "America/Phoenix" });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/calls?line=${c.line_id}&call=${c.id}`} />}><ArrowLeft /> Back to the call</Button>
        <PrintButton />
      </div>

      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">REDIAL CALL REPORT</p>
        <h1 className="text-2xl font-semibold tracking-tight">Call from {c.caller_name || c.caller_id_name || pretty(c.from_number)}</h1>
        <p className="text-sm text-muted-foreground">{when} (Arizona time) · to {line?.label ?? "Redial line"} {pretty(line?.number ?? null)}{c.duration_seconds ? ` · ${Math.ceil(c.duration_seconds / 60)} min` : ""}</p>
        {c.verdict && (
          <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"><ShieldAlert className="size-4" /> {VERDICT_LABEL[c.verdict]}</p>
        )}
      </header>

      <Section title="The caller">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Caller ID number" value={pretty(c.from_number)} />
          <Item label="Caller ID name" value={c.caller_id_name} />
          <Item label="Said their name was" value={c.caller_name} />
          <Item label="Callback number they gave" value={c.callback_number ? pretty(c.callback_number) : null} />
          <Item label="Why they said they called" value={c.purpose} wide />
        </dl>
      </Section>

      {(c.summary || summary.data?.overview) && <Section title="What happened"><p className="text-sm">{c.summary ?? summary.data?.overview}</p></Section>}

      {signals.length > 0 && (
        <Section title="What Redial noticed">
          <ul className="list-disc space-y-1 pl-5 text-sm">{signals.map((s) => <li key={s.code}>{signalText(s)}</li>)}</ul>
        </Section>
      )}

      {turns.length > 0 && (
        <Section title="What was said">
          <ol className="space-y-1.5 text-sm">
            {turns.map((t, i) => (
              <li key={i}><span className="font-medium">{t.role === "assistant" ? line?.assistant_name ?? "Assistant" : "Caller"}:</span> {t.text}</li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Transcribed automatically; may contain small mistakes.</p>
        </Section>
      )}

      <Section title="Where to report it">
        <ul className="space-y-2 text-sm">
          {WHERE.map((w) => (
            <li key={w.who}><span className="font-medium">{w.who}:</span> {w.href ? <a href={w.href} target="_blank" rel="noopener noreferrer" className="underline">{w.how}</a> : w.how}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Never send money, gift cards or codes to someone who called you. Hang up and call the person or company back on a number you already know.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 rounded-xl border p-4 print:break-inside-avoid print:border-neutral-300"><h2 className="text-sm font-semibold">{title}</h2>{children}</section>;
}
function Item({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : undefined}><dt className="text-xs text-muted-foreground">{label}</dt><dd>{value || "—"}</dd></div>;
}
