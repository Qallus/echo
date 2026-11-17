"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allows, type Access, type Call, type Callback, type Line, type ListEntry } from "@/lib/redial/types";
import type { RedialUsage } from "@/lib/redial/usage";
import { cn } from "@/lib/utils";
import { Callbacks } from "./callbacks";
import { LinePeople } from "./line-people";
import { LiveCalls } from "./live-calls";
import type { DirectoryEntry, LinePerson } from "@/lib/redial/data";
import { DirectorySettings } from "./directory-settings";
import { MirrorSettingsPanel } from "./mirror-settings";
import type { MirrorSettings } from "@/lib/redial/mirror";
import { AssistantSettings, RulesSettings, useLineForm } from "./line-settings";
import { PhoneCenter } from "./phone-center";

export { prettyNumber } from "./phone-center";

// One Redial line: the Phone (dial pad and every call in and out), callbacks,
// rules, the assistant, directory, Mirror and the people it's shared with.
export function CallsView({ line, access, calls, entries, callbacks, people, directory, mirror, initialCall, initialTab, ownerFirst, usage, canCrm = false }: {
  line: Line; access: Access; calls: Call[]; entries: ListEntry[]; callbacks: Callback[]; people: LinePerson[]; directory: DirectoryEntry[]; mirror: MirrorSettings;
  initialCall: string | null; initialTab: string | null; ownerFirst: string; usage: RedialUsage | null; canCrm?: boolean;
}) {
  const manage = allows(access, "manage_rules");
  const editDirectory = allows(access, "manage_directory");
  const form = useLineForm(line);
  const openCallbacks = callbacks.filter((c) => !c.done_at).length;
  const needsSetup = !line.forward_to;
  const tabs = ["phone", "callbacks", ...(manage ? ["rules", "assistant"] : []), ...(editDirectory ? ["directory"] : []), ...(manage ? ["mirror"] : []), ...(access.owner ? ["people"] : [])];
  const start = initialTab === "inbox" ? "phone" : tabs.includes(initialTab ?? "") ? initialTab! : "phone";

  return (
    <div className="space-y-4">
      {line.paused && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Screening is paused: calls ring straight through. Turn it back on under Rules.</p>}
      {usage && <UsageBar usage={usage} />}
      {manage && needsSetup && !line.paused && <p className="rounded-xl border p-3 text-sm">Add the phone number your assistant should ring (usually your cell) under <span className="font-medium">Rules</span>, so it can put important calls through.</p>}
      <LiveCalls line={line} owner={access.owner} canReadTranscript={allows(access, "read_transcript")} canListen={allows(access, "monitor_live")} canTakeOver={allows(access, "takeover_live")} canDirect={allows(access, "direct_agent")}
        canTransfer={allows(access, "transfer_call")} canCustomTransfer={allows(access, "dial_custom_destination")} directory={directory}
        canMirror={allows(access, "mirror") && mirror.enabled} />
      {!access.owner && <p className="rounded-xl border p-3 text-sm text-muted-foreground">This line is shared with you{manage ? "" : ". You can see its calls; only the owner changes its settings"}.</p>}
      <Tabs defaultValue={start}>
        <TabsList variant="line">
          <TabsTrigger value="phone">Phone</TabsTrigger>
          <TabsTrigger value="callbacks">Callbacks{openCallbacks ? ` (${openCallbacks})` : ""}</TabsTrigger>
          {manage && <TabsTrigger value="rules">Rules</TabsTrigger>}
          {manage && <TabsTrigger value="assistant">Assistant</TabsTrigger>}
          {editDirectory && <TabsTrigger value="directory">Directory</TabsTrigger>}
          {manage && <TabsTrigger value="mirror">Mirror</TabsTrigger>}
          {access.owner && <TabsTrigger value="people">People{people.length ? ` (${people.length})` : ""}</TabsTrigger>}
        </TabsList>

        <TabsContent value="phone" className="pt-4">
          <PhoneCenter lines={[line]} calls={calls} entries={entries} manageLines={access.owner ? [line.id] : []} canCrm={canCrm} initialCall={initialCall} />
        </TabsContent>
        <TabsContent value="callbacks" className="pt-4"><Callbacks line={line} callbacks={callbacks} calls={calls} /></TabsContent>
        {manage && <TabsContent value="rules" className="pt-4"><RulesSettings line={line} form={form} entries={entries} /></TabsContent>}
        {manage && <TabsContent value="assistant" className="pt-4"><AssistantSettings line={line} form={form} ownerFirst={ownerFirst} /></TabsContent>}
        {editDirectory && <TabsContent value="directory" className="pt-4"><DirectorySettings lineId={line.id} entries={directory} canEdit /></TabsContent>}
        {manage && <TabsContent value="mirror" className="pt-4"><MirrorSettingsPanel lineId={line.id} initial={mirror} /></TabsContent>}
        {access.owner && <TabsContent value="people" className="pt-4"><LinePeople lineId={line.id} people={people} /></TabsContent>}
      </Tabs>
    </div>
  );
}

// "12 of 50 screening minutes used this month", with a way to get more.
function UsageBar({ usage: u }: { usage: RedialUsage }) {
  const pct = u.allowance ? Math.min(100, (u.used_minutes / u.allowance) * 100) : 100;
  const out = u.remaining_seconds < 30;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3", out && "border-destructive/40 bg-destructive/5")}>
      <div className="min-w-48 flex-1 space-y-1.5">
        <p className="text-sm">
          <span className="font-medium tabular-nums">{u.used_minutes}</span> of <span className="tabular-nums">{u.allowance}</span> screening minutes used this month
          {u.pack_minutes > 0 && <span className="text-muted-foreground"> (includes {u.pack_minutes} pack minutes)</span>}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={u.allowance} aria-valuenow={u.used_minutes} aria-label="Screening minutes used">
          <div className={cn("h-full rounded-full", out ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        {out && <p className="text-xs text-destructive">Unknown callers go to voicemail until your minutes reset next month.</p>}
        {u.free && !out && <p className="text-xs text-muted-foreground">Free trial minutes. A Redial plan adds more every month.</p>}
      </div>
      <Button size="sm" variant={out ? "default" : "outline"} nativeButton={false} render={<Link href="/pricing" />}>{u.free ? "Get Redial" : "Add minutes"}</Button>
    </div>
  );
}
