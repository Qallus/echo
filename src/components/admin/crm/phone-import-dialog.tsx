"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import QRCode from "qrcode";
import { ArrowLeft, BookUser, Check, FileUp, Loader2, Search, Smartphone, UserRoundCheck } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importContacts } from "@/lib/admin/actions/crm-people";
import {
  ALL_FIELDS, FIELDS, applyFields, contactsManager, parseVCards, pickContacts, shrinkPhotos, summary, toCandidates, type Candidate, type FieldId,
} from "@/lib/crm/phone-import";
import type { Contact } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIphone = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const FIELDS_KEY = "echo.phone-import.fields";
const BATCH = 100; // rows per request (server actions accept about 1 MB)

const readSaved = () => { try { return localStorage.getItem(FIELDS_KEY) ?? ""; } catch { return ""; } };
function parseFields(raw: string): Set<FieldId> {
  try {
    const v = JSON.parse(raw || "null");
    if (Array.isArray(v)) return new Set(v.filter((x): x is FieldId => (ALL_FIELDS as string[]).includes(x)));
  } catch {}
  return new Set(ALL_FIELDS);
}

// Import from phone. On a computer: a QR code opens this on the phone, or
// upload a contacts file. On the phone: all contacts (a contacts file, every
// field) or specific people (the phone's picker). Choose the fields, review,
// and nothing is saved until Import.
export function PhoneImportDialog({ existing, onClose }: { existing: Contact[]; onClose: () => void }) {
  const router = useRouter();
  const phone = useSyncExternalStore(noop, isPhone, () => false);
  const iphone = useSyncExternalStore(noop, isIphone, () => false);
  const picker = useSyncExternalStore(noop, () => contactsManager() !== null, () => false);
  const url = useSyncExternalStore(noop, () => `${location.origin}/admin/contacts?import=phone`, () => "");
  const [qr, setQr] = useState<string | null>(null);
  const saved = useSyncExternalStore(noop, readSaved, () => "");
  const [chosen, setChosen] = useState<Set<FieldId> | null>(null);
  const fields = useMemo(() => chosen ?? parseFields(saved), [chosen, saved]);
  const [via, setVia] = useState<"file" | "picker">("file");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"contact" | "lead">("contact");
  const [dupes, setDupes] = useState<"skip" | "fill">("skip");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // QR for the computer; while it's showing, refresh so phone imports appear here.
  useEffect(() => {
    if (phone || !url) return;
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(null));
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [phone, url, router]);

  const toggleField = (f: FieldId) => {
    const n = new Set(fields);
    if (n.has(f)) n.delete(f); else n.add(f);
    try { localStorage.setItem(FIELDS_KEY, JSON.stringify([...n])); } catch {}
    setChosen(n);
  };

  const receive = (rows: ReturnType<typeof parseVCards>, from: "file" | "picker") => {
    if (!rows.length) { setMsg({ error: from === "file" ? "No contacts found. Make sure it's a .vcf contacts file." : "No contacts were chosen." }); return; }
    const list = toCandidates(rows, existing);
    setMsg({});
    setVia(from);
    setCandidates(list);
    setSelected(new Set(list.filter((c) => !c.duplicate || dupes === "fill").map((c) => c.key)));
  };

  const openFile = async (files: File[]) => {
    if (!files.length) return;
    setBusy("Reading your contacts…");
    try {
      let rows = parseVCards((await Promise.all(files.map((f) => f.text()))).join("\n"));
      const photos = rows.filter((r) => r.photo?.startsWith("data:")).length;
      if (photos) rows = await shrinkPhotos(rows, (n) => setBusy(`Preparing photos… ${n} of ${photos}`));
      receive(rows, "file");
    } catch {
      setMsg({ error: "Couldn't read that file. Export it again from your phone's Contacts app." });
    } finally { setBusy(null); }
  };

  const openPicker = async () => {
    const m = contactsManager();
    if (!m) return;
    setBusy("Opening your contacts…");
    try {
      receive(await pickContacts(m, fields), "picker");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg({ error: "Couldn't open your contacts. Use a contacts file instead." });
    } finally { setBusy(null); }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (candidates ?? []).filter((c) => !q || `${c.row.first_name ?? ""} ${c.row.last_name ?? ""} ${summary(c.row)} ${c.row.tags ?? ""}`.toLowerCase().includes(q));
  }, [candidates, query]);
  const allShown = shown.length > 0 && shown.every((c) => selected.has(c.key));
  const dupeCount = (candidates ?? []).filter((c) => c.duplicate).length;
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const chooseDupes = (mode: "skip" | "fill") => {
    setDupes(mode);
    setSelected((s) => { const n = new Set(s); for (const c of candidates ?? []) if (c.duplicate) { if (mode === "fill") n.add(c.key); else n.delete(c.key); } return n; });
  };

  const commit = () => start(async () => {
    const rows = (candidates ?? []).filter((c) => selected.has(c.key)).map((c) => applyFields(c.row, fields));
    let imported = 0, updated = 0, skipped = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      setBusy(`Importing ${Math.min(i + BATCH, rows.length)} of ${rows.length}…`);
      const res = await importContacts(rows.slice(i, i + BATCH), role, dupes);
      if (res.error) { setBusy(null); setMsg({ error: imported || updated ? `${imported} imported before an error: ${res.error}` : res.error }); return; }
      imported += res.imported ?? 0; updated += res.updated ?? 0; skipped += res.skipped ?? 0;
    }
    setBusy(null);
    setMsg({ ok: [`${imported} imported`, updated && `${updated} updated`, skipped && `${skipped} skipped`].filter(Boolean).join(", ") + "." });
    setCandidates(null);
    router.refresh();
  });

  const fieldPicker = (mode: "file" | "picker" | "both") => (
    <div className="space-y-2">
      <p className="text-sm font-medium">What to bring over</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"><Check className="size-3" /> Name</span>
        {FIELDS.map((f) => {
          const off = mode === "picker" && !f.picker;
          const on = fields.has(f.id) && !off;
          return (
            <button key={f.id} type="button" disabled={off} onClick={() => toggleField(f.id)} aria-pressed={on}
              title={off ? "Only from a contacts file" : undefined}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                on ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/50", off && "cursor-not-allowed opacity-50")}>
              {on && <Check className="size-3" />}{f.label}
            </button>
          );
        })}
      </div>
      {mode === "both" && picker && <p className="text-xs text-muted-foreground">Picking specific people shares only name, numbers, emails, addresses and photo. A contacts file brings everything.</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Import from phone" description={candidates ? "Pick who to add. People already in Echo are marked." : undefined}
        className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        {busy ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {busy}</p>
        ) : !candidates ? (
          <div className="space-y-4">
            {!phone && (
              <div className="flex flex-col items-center gap-3 rounded-xl border p-5 text-center sm:flex-row sm:text-left">
                {qr ? <img src={qr} alt="QR code to import contacts from your phone" className="size-40 shrink-0 rounded-lg border bg-white p-1" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="flex size-40 shrink-0 items-center justify-center rounded-lg border"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Continue on your phone</p>
                  <p className="text-muted-foreground">Scan with your phone&apos;s camera to open this there (sign in if asked). Bring over all your contacts or pick specific people; they show up here when you import.</p>
                  {url.includes("localhost") && <p className="text-xs text-amber-700 dark:text-amber-300">This is a local address your phone can&apos;t reach. Use echo.redial.si to scan.</p>}
                </div>
              </div>
            )}

            {fieldPicker(phone ? "both" : "file")}

            <div className={cn("grid gap-3", phone && picker && "sm:grid-cols-2")}>
              <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 hover:bg-muted/40 has-focus-visible:ring-2 has-focus-visible:ring-ring">
                <span className="flex items-center gap-2 font-medium"><FileUp className="size-4" /> {phone ? "All contacts" : "Upload a contacts file (.vcf)"}</span>
                <span className="text-xs text-muted-foreground">{phone ? "Choose your exported contacts file. Brings every field: photos, all numbers, company, groups, notes." : "Export once from your phone, then choose the file here. Brings every field."}</span>
                <input type="file" accept=".vcf,text/vcard,text/x-vcard" multiple className="sr-only"
                  onChange={(e) => { void openFile([...(e.target.files ?? [])]); e.target.value = ""; }} />
              </label>
              {phone && picker && (
                <button type="button" onClick={openPicker} className="flex flex-col gap-1.5 rounded-xl border p-4 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <span className="flex items-center gap-2 font-medium"><BookUser className="size-4" /> Choose specific contacts</span>
                  <span className="text-xs text-muted-foreground">Opens your phone&apos;s contact list. Tap the people you want, then Done.</span>
                </button>
              )}
            </div>

            <details className="rounded-xl border px-4 py-3 text-sm" open={phone && !picker}>
              <summary className="cursor-pointer font-medium"><Smartphone className="mr-1.5 inline size-4" />How to export all your contacts</summary>
              {iphone || !phone ? (
                <div className="mt-2 space-y-2 text-muted-foreground">
                  <p className="font-medium text-foreground">iPhone</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Open <b>Contacts</b> and tap <b>Lists</b> (top left).</li>
                    <li>Touch and hold <b>All Contacts</b>, then tap <b>Export</b>.</li>
                    <li>Choose the fields (turn on Photo and Notes), tap <b>Done</b>, then <b>Save to Files</b>.</li>
                    <li>Come back here and choose that file.</li>
                  </ol>
                </div>
              ) : null}
              {!iphone && (
                <div className="mt-2 space-y-2 text-muted-foreground">
                  <p className="font-medium text-foreground">Android</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Open the <b>Contacts</b> app and tap the menu (or your profile) → <b>Settings</b>.</li>
                    <li>Tap <b>Export</b> (Samsung: <b>Manage contacts → Import or export contacts → Export</b>).</li>
                    <li>Pick the account (or all), and save the <code>.vcf</code> file.</li>
                    <li>Come back here and choose that file.</li>
                  </ol>
                </div>
              )}
            </details>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCandidates(null)}><ArrowLeft /> Back</Button>
              <div className="relative min-w-40 flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, number, email, company" className="pl-8" aria-label="Search contacts to import" />
              </div>
            </div>
            {fieldPicker(via)}
            <label className="flex items-center gap-2 px-1 text-sm">
              <input type="checkbox" checked={allShown} onChange={() => setSelected((s) => { const n = new Set(s); shown.forEach((c) => (allShown ? n.delete(c.key) : n.add(c.key))); return n; })} />
              Select all ({shown.length}) · {selected.size} selected
            </label>
            <ul className="max-h-[42dvh] divide-y overflow-y-auto rounded-xl border">
              {shown.map((c) => {
                const name = [c.row.first_name, c.row.last_name].filter(Boolean).join(" ");
                return (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                      <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                      <UserAvatar name={name} email={c.row.email ?? ""} src={fields.has("photo") ? c.row.photo : null} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{summary(c.row) || "Name only"}</span>
                      </span>
                      {c.duplicate && <Badge variant="outline" className="shrink-0 text-[10px]">In Echo</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
            {dupeCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <UserRoundCheck className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{dupeCount} already in Echo:</span>
                <Button size="sm" variant={dupes === "skip" ? "secondary" : "ghost"} onClick={() => chooseDupes("skip")}>Skip them</Button>
                <Button size="sm" variant={dupes === "fill" ? "secondary" : "ghost"} onClick={() => chooseDupes("fill")}>Fill in missing details</Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Add new people as</span>
              <Button size="sm" variant={role === "contact" ? "secondary" : "ghost"} onClick={() => setRole("contact")}>Contacts</Button>
              <Button size="sm" variant={role === "lead" ? "secondary" : "ghost"} onClick={() => setRole("lead")}>Leads</Button>
            </div>
          </div>
        )}
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{msg.ok ? "Done" : "Cancel"}</Button>
          {candidates && !busy && <Button onClick={commit} disabled={pending || selected.size === 0}>{pending ? "Importing…" : `Import ${selected.size}`}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
