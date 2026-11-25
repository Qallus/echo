"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, LayoutGrid, Mic, Phone, PhoneCall, Search, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InCallControls, Keys, cleanDial, clock, formatDial } from "@/components/phone/dialer";
import { useBrowserPhone } from "@/components/redial/use-browser-phone";
import { useRecorder } from "@/components/recorder/recorder-provider";
import { InstallAppButton } from "@/components/shell/install-app";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { normalizeNumber } from "@/lib/redial/types";
import { cn } from "@/lib/utils";
import { Empty, Frame } from "../kit";
import { WeatherCard } from "./weather";

// Tools on the dashboard: search, all features, the clock, weather, dialpad,
// recorder, notepad, Ask Echo, quick links and the desktop app.

type Set = (patch: Record<string, unknown>) => void;

export function SearchCard() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <Frame bodyClassName="flex items-center">
      <form className="relative w-full" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calls, recordings, transcripts and pages" aria-label="Search"
          className="h-11 rounded-xl pr-12 pl-10 text-base" />
        <Button type="submit" size="icon-sm" variant="ghost" className="absolute top-1/2 right-1.5 -translate-y-1/2" aria-label="Search"><ArrowRight /></Button>
      </form>
    </Frame>
  );
}

export function AllFeaturesCard({ open }: { open: () => void }) {
  return (
    <button type="button" onClick={open}
      className="group flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/50">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-105"><LayoutGrid className="size-5" /></span>
      <span className="text-sm font-medium">All features</span>
    </button>
  );
}

const noop = () => () => {};
function useNow(every = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(t);
  }, [every]);
  return mounted ? now ?? new Date() : null;
}

export function ClockCard() {
  const now = useNow(1000);
  return (
    <Frame bodyClassName="flex flex-col justify-center">
      {now ? (
        <>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            <span className="ml-1 text-sm font-normal text-muted-foreground tabular-nums">{String(now.getSeconds()).padStart(2, "0")}</span></p>
          <p className="text-sm text-muted-foreground">{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
        </>
      ) : <div className="h-14 animate-pulse rounded-lg bg-muted" />}
    </Frame>
  );
}

export function WeatherSlot({ data }: { data: DashboardData }) {
  return <WeatherCard location={data.location} />;
}

export function DialpadCard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const line = data.ownLines[0];
  const [dial, setDial] = useState("");
  const phone = useBrowserPhone(() => router.refresh());
  const meta = CARDS.dialpad;
  if (!line) return <Frame title={meta.title} icon={meta.icon}><Empty action={<Link href="/setup" className="text-xs underline">Set up Redial</Link>}>Get a Redial number to call from here.</Empty></Frame>;
  const to = normalizeNumber(dial);
  if (phone.state !== "idle") {
    return (
      <Frame title={`On a call · ${clock(phone.seconds)}`} icon={PhoneCall}>
        <InCallControls compact label={formatDial(dial)} status={phone.state === "live" ? "live" : "connecting"} seconds={phone.seconds} muted={phone.muted}
          onMute={phone.toggleMute} onDigit={phone.digit} onHangUp={phone.hangUp} />
      </Frame>
    );
  }
  return (
    <Frame title={`Dialpad · ${line.label}`} icon={meta.icon} href="/calls?tab=phone">
      <div className="space-y-3">
        <Input value={formatDial(dial)} onChange={(e) => setDial(cleanDial(e.target.value))} placeholder="Enter a number" aria-label="Number to call"
          className="h-11 text-center text-lg tabular-nums" onKeyDown={(e) => { if (e.key === "Enter" && to) void phone.place({ To: to, LineId: line.id, Record: line.record ? "1" : "0" }); }} />
        <Keys size="sm" onPress={(k) => setDial((d) => cleanDial(d + k))} onPlus={() => setDial((d) => (d ? d : "+"))} />
        {phone.error && <p className="text-xs text-destructive">{phone.error}</p>}
        <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!to || phone.busy}
          onClick={() => to && void phone.place({ To: to, LineId: line.id, Record: line.record ? "1" : "0" })}><Phone /> Call</Button>
      </div>
    </Frame>
  );
}

export function RecorderCard() {
  const r = useRecorder();
  const meta = CARDS.recorder;
  const busy = r.status !== "idle";
  return (
    <Frame title={meta.title} icon={meta.icon} href="/studio">
      {busy ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <span className="relative flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex size-3 rounded-full bg-red-500" /></span>
          <p className="text-2xl font-semibold tabular-nums">{clock(Math.round(r.elapsed))}</p>
          <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button size="lg" className="w-full" onClick={() => r.openStart("meeting")}><Mic /> Record a meeting</Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => r.openStart("phone_call")}><Phone /> Record a call</Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => r.openUpload()}><Upload /> Upload audio</Button>
        </div>
      )}
    </Frame>
  );
}

export function NotepadCard({ settings, set }: { settings?: Record<string, unknown>; set: Set }) {
  const [text, setText] = useState(String(settings?.text ?? ""));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ text: v.slice(0, 20000) }), 700);
  };
  return (
    <Frame title={String(settings?.title ?? "Notepad")} icon={CARDS.notepad.icon}>
      <Textarea value={text} onChange={(e) => change(e.target.value)} placeholder="Jot something down. It saves as you type."
        className="h-full min-h-36 resize-none border-0 bg-amber-50/60 p-3 shadow-none focus-visible:ring-1 dark:bg-amber-500/5" aria-label="Notes" />
    </Frame>
  );
}

export function AskEchoCard() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = () => { if (q.trim()) router.push(`/ask?q=${encodeURIComponent(q.trim())}`); };
  return (
    <Frame title="Ask Echo" icon={CARDS.ask_echo.icon} href="/ask">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What did we decide on Tuesday's call? What can Redial do?"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }} aria-label="Ask Echo" />
        <div className="flex flex-wrap gap-1.5">
          {["Summarize this week's calls", "List my action items", "What can Redial do?"].map((s) => (
            <button key={s} type="button" onClick={() => router.push(`/ask?q=${encodeURIComponent(s)}`)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">{s}</button>
          ))}
          <Button type="submit" size="sm" className="ml-auto" disabled={!q.trim()}><Send /> Ask</Button>
        </div>
      </form>
    </Frame>
  );
}

const LINKS = [
  { href: "/calls?tab=phone", label: "Dialpad" }, { href: "/sms", label: "SMS" }, { href: "/calendar", label: "Calendar" },
  { href: "/contacts", label: "Contacts" }, { href: "/studio", label: "Studio" }, { href: "/call-tree", label: "Call Tree" },
  { href: "/pipeline", label: "Pipeline" }, { href: "/settings", label: "Profile" },
];
export function QuickLinksCard() {
  return (
    <Frame title="Quick links" icon={CARDS.quick_links.icon}>
      <div className="grid grid-cols-2 gap-1.5">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className={cn("rounded-lg border px-3 py-2 text-sm hover:bg-muted")}>{l.label}</Link>)}
      </div>
    </Frame>
  );
}

export function InstallCard() {
  return (
    <Frame title="Desktop app" icon={CARDS.install_app.icon}>
      <p className="mb-2 text-sm text-muted-foreground">Redial in its own window, in your dock or taskbar.</p>
      <InstallAppButton />
    </Frame>
  );
}
