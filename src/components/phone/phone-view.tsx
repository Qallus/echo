"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, GitMerge, PhoneCall, PhoneOutgoing, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LocalDate } from "@/components/local-date";
import { placeLineCall, removePhone, saveLinePrefs, verifyPhone } from "@/lib/line/actions";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LinePhone = { number: string; status: "pending" | "verified" | "failed"; validation_code: string | null; workspace_id: string | null; ask_workspace: boolean; announce: boolean; verified_at: string | null };
export type LineCall = { id: string; kind: "outbound" | "merge"; to_number: string | null; status: string; error: string | null; recording_id: string | null; duration_seconds: number | null; created_at: string };

const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "");
const STATUS: Record<string, string> = {
  queued: "Starting", ringing_you: "Ringing you", connecting: "Connecting", in_progress: "Recording", completed: "Done",
  no_answer: "No answer", failed: "Failed", canceled: "Canceled",
};

export function PhoneView({ line, phone, calls, workspaces }: { line: string; phone: LinePhone | null; calls: LineCall[]; workspaces: Workspace[] }) {
  const verified = phone?.status === "verified";
  return (
    <div className="space-y-8">
      {verified ? <CallPanel line={line} phone={phone!} workspaces={workspaces} /> : <VerifyPanel phone={phone} />}
      {verified && <Prefs phone={phone!} workspaces={workspaces} />}
      {calls.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent calls</h2>
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                {c.kind === "outbound" ? <PhoneOutgoing className="size-4 text-muted-foreground" /> : <GitMerge className="size-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.kind === "outbound" ? pretty(c.to_number) : "Merged call"}</p>
                  <p className="text-xs text-muted-foreground">
                    <LocalDate iso={c.created_at} short /> · {STATUS[c.status] ?? c.status}{c.duration_seconds ? ` · ${Math.ceil(c.duration_seconds / 60)} min` : ""}{c.error ? ` · ${c.error}` : ""}
                  </p>
                </div>
                {c.recording_id ? <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/recordings/${c.recording_id}`} />}>Open recording</Button>
                  : c.status === "completed" ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function VerifyPanel({ phone }: { phone: LinePhone | null }) {
  const router = useRouter();
  const [number, setNumber] = useState(pretty(phone?.number ?? null));
  const [code, setCode] = useState<string | null>(phone?.status === "pending" ? phone.validation_code : null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Verify your cell number</h2>
        <p className="text-sm text-muted-foreground">Echo calls people from your own number, so first prove it&apos;s yours: Twilio calls you and you type the code shown here.</p>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await verifyPhone(number); setMsg(r); if (r.code) setCode(r.code); }); }}>
        <div className="space-y-1"><Label htmlFor="ph-num">Your cell</Label><Input id="ph-num" type="tel" className="w-48" placeholder="(480) 555-0142" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
        <Button type="submit" disabled={pending}>{pending ? "Calling…" : "Call me to verify"}</Button>
      </form>
      {code && (
        <div className="space-y-2 rounded-lg bg-muted/60 p-4">
          <p className="text-sm">When Twilio calls, enter this code on your keypad:</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{code}</p>
          <Button size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw /> I&apos;ve entered it</Button>
        </div>
      )}
      {phone?.status === "failed" && !code && <p className="text-sm text-destructive">The last check didn&apos;t go through. Try again.</p>}
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
    </section>
  );
}

function CallPanel({ line, phone, workspaces }: { line: string; phone: LinePhone; workspaces: Workspace[] }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [ws, setWs] = useState<string>(phone.workspace_id ?? "");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><PhoneOutgoing className="size-4" /> Call &amp; record</h2>
        <p className="text-sm text-muted-foreground">Echo rings your phone first. Press 1, and it dials them showing your number, {pretty(phone.number)}.</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await placeLineCall(to, ws || null); setMsg(r); if (r.ok) { setTo(""); router.refresh(); } }); }}>
          <div className="space-y-1"><Label htmlFor="ph-to">Number to call</Label><Input id="ph-to" type="tel" placeholder="(602) 555-0199" value={to} onChange={(e) => setTo(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor="ph-ws">Save to</Label>
            <Pick id="ph-ws" label="Save to" value={ws} onChange={setWs}
              options={[{ value: "", label: phone.ask_workspace ? "Ask me on the call" : "My default workspace" }, ...workspaces.map((w) => ({ value: w.id, label: w.isPersonal ? "Personal" : w.name }))]} />
          </div>
          <Button type="submit" disabled={pending}><PhoneCall /> {pending ? "Ringing you…" : "Call"}</Button>
        </form>
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><GitMerge className="size-4" /> Record a call you&apos;re on</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>While on the call, tap <span className="font-medium text-foreground">Add call</span>.</li>
          <li>Call the Echo line: <a href={`tel:${line}`} className="font-medium text-foreground underline">{pretty(line)}</a></li>
          <li>Tap <span className="font-medium text-foreground">Merge calls</span>. Echo records until you hang up.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Save {pretty(line)} as a contact named &ldquo;Echo&rdquo; to find it quickly. It only records calls from your verified cell.</p>
      </section>
    </div>
  );
}

function Prefs({ phone, workspaces }: { phone: LinePhone; workspaces: Workspace[] }) {
  const [p, setP] = useState({ workspaceId: phone.workspace_id ?? "", askWorkspace: phone.ask_workspace, announce: phone.announce });
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Settings</h2>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><CircleCheck className="size-4 text-emerald-600" /> {pretty(phone.number)} verified
          <button type="button" className="ml-2 underline" disabled={pending} onClick={() => { if (confirm("Remove your verified number? You'll need to verify again to record calls.")) start(async () => setMsg(await removePhone())); }}>Change</button>
        </span>
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        <div className="space-y-1 sm:max-w-xs"><Label htmlFor="ph-def">Save recordings to</Label>
          <Pick id="ph-def" label="Save recordings to" value={p.workspaceId} onChange={(v) => setP({ ...p, workspaceId: v })}
            options={[{ value: "", label: "Personal" }, ...workspaces.filter((w) => !w.isPersonal).map((w) => ({ value: w.id, label: w.name }))]} />
        </div>
        <Toggle label="Ask on outbound calls" detail="Press 1 for Personal or 2 for Business when Echo rings you. Only you hear it." checked={p.askWorkspace} onChange={(askWorkspace) => setP({ ...p, askWorkspace })} />
        <Toggle label="Play a recording notice" detail="Both sides hear “This call is being recorded.” Off by default; you're responsible for telling people where the law requires it." checked={p.announce} onChange={(announce) => setP({ ...p, announce })} />
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={pending} onClick={() => start(async () => setMsg(await saveLinePrefs({ workspaceId: p.workspaceId || null, askWorkspace: p.askWorkspace, announce: p.announce })))}>Save</Button>
          {(msg.ok || msg.error) && <p className={cn("text-sm", msg.error ? "text-destructive" : "text-muted-foreground")}>{msg.error ?? msg.ok}</p>}
        </div>
      </div>
    </section>
  );
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
