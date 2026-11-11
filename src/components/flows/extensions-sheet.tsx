"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hash, Pencil, Trash2 } from "lucide-react";
import { useBuilder } from "@/components/flows/builder-context";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteExtension, saveExtension, type ExtensionInput } from "@/lib/flows/actions";
import type { BuilderExtension } from "@/lib/flows/data";

// Extensions on a line (101 → Sales): what Connect blocks ring and what
// callers can dial from a menu. Needs manage_flows on the line.

export function ExtensionsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { lines, extensions, directory, recordings } = useBuilder();
  const router = useRouter();
  const manageable = lines.filter((l) => l.canManage);
  const [lineId, setLineId] = useState(manageable[0]?.id ?? "");
  const blank = (): ExtensionInput => ({ lineId, ext: "", name: "", directoryId: null, number: "", ringSeconds: 20, voicemailAudioId: null });
  const [form, setForm] = useState<ExtensionInput>(blank);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const lineExts = extensions.filter((e) => e.lineId === lineId);
  const lineDir = directory.filter((d) => d.lineId === lineId);
  const set = (patch: Partial<ExtensionInput>) => setForm((f) => ({ ...f, ...patch }));

  function edit(e: BuilderExtension) {
    setForm({ id: e.id, lineId: e.lineId, ext: e.ext, name: e.name, directoryId: e.directoryId, number: e.number ?? "", ringSeconds: e.ringSeconds, voicemailAudioId: e.voicemailAudioId });
    setMsg(null);
  }
  function run(act: () => Promise<{ ok?: string; error?: string }>, reset = true) {
    start(async () => {
      const r = await act();
      setMsg(r.error ? { text: r.error, error: true } : { text: r.ok ?? "Saved." });
      if (!r.error) { if (reset) setForm(blank()); router.refresh(); }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Extensions</SheetTitle>
          <SheetDescription>Give people and teams a short number, like 101 for Sales. Connect blocks can ring them, and callers can dial them from a menu.</SheetDescription>
        </SheetHeader>
        {manageable.length === 0 ? (
          <div className="space-y-3 px-4">
            <p className="text-sm text-muted-foreground">Extensions belong to a Redial line. Set up your line first, then come back to add them.</p>
            <Button variant="outline" nativeButton={false} render={<Link href="/setup" />}>Set up Redial</Button>
          </div>
        ) : (
          <div className="space-y-5 px-4 pb-6">
            {manageable.length > 1 && (
              <label className="block space-y-1.5"><span className="text-sm font-medium">Line</span>
                <Pick label="Line" value={lineId} onChange={(v) => { setLineId(v); setForm({ ...blank(), lineId: v }); }} options={manageable.map((l) => ({ value: l.id, label: `${l.label} · ${l.number}` }))} />
              </label>
            )}

            <ul className="divide-y rounded-xl border">
              {lineExts.length === 0 && <li className="p-3 text-sm text-muted-foreground">No extensions on this line yet.</li>}
              {lineExts.map((e) => {
                const dir = directory.find((d) => d.id === e.directoryId);
                return (
                  <li key={e.id} className="flex items-center gap-3 p-3">
                    <span className="flex h-8 min-w-12 items-center justify-center rounded-md bg-muted px-2 text-sm font-semibold tabular-nums">{e.ext}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{dir ? dir.label : e.number} · rings {e.ringSeconds}s{e.voicemailAudioId ? " · voicemail greeting" : ""}</span>
                    </span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.ext}`} onClick={() => edit(e)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${e.ext}`} disabled={pending} onClick={() => run(() => deleteExtension(e.id), form.id === e.id)}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>

            <form className="space-y-3 rounded-xl border p-4" onSubmit={(ev) => { ev.preventDefault(); run(() => saveExtension({ ...form, lineId })); }}>
              <p className="flex items-center gap-2 text-sm font-semibold"><Hash className="size-4" /> {form.id ? `Edit extension ${form.ext}` : "Add an extension"}</p>
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <Input inputMode="numeric" maxLength={6} placeholder="101" aria-label="Extension number" value={form.ext} onChange={(e) => set({ ext: e.target.value.replace(/\D/g, "") })} />
                <Input maxLength={80} placeholder="Sales" aria-label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Rings</span>
                <Pick label="Rings" value={form.directoryId ?? ""} onChange={(v) => set({ directoryId: v || null })} options={[{ value: "", label: "A phone number" }, ...lineDir.map((d) => ({ value: d.id, label: `${d.label} (Directory)` }))]} />
              </label>
              {!form.directoryId && <Input inputMode="tel" placeholder="(480) 555-0142" aria-label="Number to ring" value={form.number} onChange={(e) => set({ number: e.target.value })} />}
              <label className="block space-y-1.5"><span className="text-sm font-medium">Ring for</span>
                <Pick label="Ring for" value={String(form.ringSeconds)} onChange={(v) => set({ ringSeconds: Number(v) })} options={[10, 15, 20, 25, 30, 45, 60].map((s) => ({ value: String(s), label: `${s} seconds` }))} />
              </label>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Voicemail greeting</span>
                <Pick label="Voicemail greeting" value={form.voicemailAudioId ?? ""} onChange={(v) => set({ voicemailAudioId: v || null })} options={[{ value: "", label: "The standard greeting" }, ...recordings.map((r) => ({ value: r.id, label: r.name }))]} />
              </label>
              {msg && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : form.id ? "Save" : "Add extension"}</Button>
                {form.id && <Button type="button" variant="ghost" onClick={() => { setForm(blank()); setMsg(null); }}>Cancel</Button>}
              </div>
            </form>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
