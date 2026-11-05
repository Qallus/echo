"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveMirrorSettings } from "@/lib/redial/actions";
import { FEATURES } from "@/lib/redial/features";
import type { MirrorSettings } from "@/lib/redial/mirror";

type Toggle = keyof Pick<MirrorSettings, "enabled" | "auto_start" | "use_knowledge" | "use_history" | "use_directory" | "allow_sms" | "allow_email">;

const GROUPS: { title: string; items: { key: Toggle; label: string; detail: string }[] }[] = [
  { title: "When", items: [
    { key: "enabled", label: `Use ${FEATURES.mirror.name} on this line`, detail: "It listens silently while a person is on a call with the caller. It never speaks or joins the call." },
    { key: "auto_start", label: "Start on its own", detail: "When you take a call over or accept a put-through call. Otherwise start it from the live call card." },
  ] },
  { title: "What it can read", items: [
    { key: "use_knowledge", label: "Your notes", detail: "The knowledge below and the About text on the Assistant tab: products, services, prices, hours, policies." },
    { key: "use_history", label: "Earlier calls from the same number", detail: "Summaries of past calls, so it can remind you what they called about before." },
    { key: "use_directory", label: "Your transfer directory", detail: "Names and numbers it can suggest sharing or transferring to." },
  ] },
  { title: "What it can draft", items: [
    { key: "allow_sms", label: "Texts to the caller", detail: "Sent from this line's number, only after you review and press Send." },
    { key: "allow_email", label: "Emails to the caller", detail: "Sent by Echo with replies going to you, only after you review and press Send." },
  ] },
];

// Mirror settings: what the silent call assistant may read and draft.
export function MirrorSettingsPanel({ lineId, initial }: { lineId: string; initial: MirrorSettings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const set = (k: Toggle, v: boolean) => setS((x) => ({ ...x, [k]: v }));

  return (
    <form className="max-w-2xl space-y-6" onSubmit={(e) => { e.preventDefault(); start(async () => setMsg(await saveMirrorSettings(lineId, s))); }}>
      <p className="text-sm text-muted-foreground">{FEATURES.mirror.detail} Suggestions show on the live call card; nothing is said or sent without you.</p>
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-medium">{g.title}</legend>
          {g.items.map((it) => (
            <label key={it.key} className="flex items-start justify-between gap-4">
              <span><span className="block text-sm">{it.label}</span><span className="block text-xs text-muted-foreground">{it.detail}</span></span>
              <Switch checked={s[it.key]} disabled={it.key !== "enabled" && !s.enabled} onCheckedChange={(v) => set(it.key, v)} />
            </label>
          ))}
        </fieldset>
      ))}
      <div className="space-y-1.5">
        <Label htmlFor="mirror-knowledge">Knowledge for {FEATURES.mirror.name}</Label>
        <Textarea id="mirror-knowledge" rows={8} maxLength={20000} value={s.knowledge ?? ""} disabled={!s.enabled}
          placeholder={"Products and prices, service areas, hours, booking link, FAQs, who handles what.\ne.g. Roof inspections are free. Repairs start at $350. Book at example.com/book."}
          onChange={(e) => setS((x) => ({ ...x, knowledge: e.target.value }))} />
        <p className="text-xs text-muted-foreground">It only states facts from here, your About text, earlier calls and the directory. If something isn&apos;t covered, it suggests asking or following up.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
    </form>
  );
}
