"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import QRCode from "qrcode";
import { ArrowLeft, FileUp, Loader2, Search, Smartphone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importContacts } from "@/lib/admin/actions/crm-people";
import { contactsManager, fromPicked, parseVCards, toCandidates, type Candidate } from "@/lib/crm/phone-import";
import type { Contact } from "@/lib/crm/types";

const noop = () => () => {};
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Import from phone (Channel-Cast's phone-import-modal). On a computer: a QR
// code opens this on the phone. On the phone: the contact picker (Android
// Chrome) or a shared .vcf (iPhone, any phone). Then review and pick one,
// some or all; nothing is saved until Import.
export function PhoneImportDialog({ existing, onClose }: { existing: Contact[]; onClose: () => void }) {
  const router = useRouter();
  const phone = useSyncExternalStore(noop, isPhone, () => false);
  const picker = useSyncExternalStore(noop, () => contactsManager() !== null, () => false);
  const url = useSyncExternalStore(noop, () => `${location.origin}/admin/contacts?import=phone`, () => "");
  const [qr, setQr] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"contact" | "lead">("contact");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  // QR for the computer; while it's showing, refresh so phone imports appear here.
  useEffect(() => {
    if (phone || !url) return;
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(null));
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [phone, url, router]);

  const receive = (rows: ReturnType<typeof parseVCards>) => {
    if (!rows.length) { setMsg({ error: "No contacts found. Make sure it's a .vcf contact file." }); return; }
    const list = toCandidates(rows, existing);
    setMsg({});
    setCandidates(list);
    setSelected(new Set(list.filter((c) => !c.duplicate).map((c) => c.key)));
  };

  const openPicker = async () => {
    const m = contactsManager();
    if (!m) return;
    setBusy(true);
    try {
      const supported = await m.getProperties().catch(() => ["name", "email", "tel"]);
      const picked = await m.select(["name", "email", "tel", "address"].filter((p) => supported.includes(p)), { multiple: true });
      if (picked.length) receive(picked.map(fromPicked));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg({ error: "Couldn't open your contacts. Try a .vcf file instead." });
    } finally { setBusy(false); }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (candidates ?? []).filter((c) => !q || `${c.row.first_name ?? ""} ${c.row.last_name ?? ""} ${c.row.email ?? ""} ${c.row.phone ?? ""} ${c.row.company ?? ""}`.toLowerCase().includes(q));
  }, [candidates, query]);
  const allShown = shown.length > 0 && shown.every((c) => selected.has(c.key));
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const commit = () => start(async () => {
    const rows = (candidates ?? []).filter((c) => selected.has(c.key)).map((c) => c.row);
    const res = await importContacts(rows, role);
    setMsg(res);
    if (!res.error) setCandidates(null);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Import from phone" description={candidates ? "Pick who to add. People already in Echo are unticked." : undefined}
        className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        {!candidates ? (
          <div className="space-y-4">
            {!phone && (
              <div className="flex flex-col items-center gap-3 rounded-xl border p-5 text-center sm:flex-row sm:text-left">
                {qr ? <img src={qr} alt="QR code to import contacts from your phone" className="size-40 shrink-0 rounded-lg border bg-white p-1" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="flex size-40 shrink-0 items-center justify-center rounded-lg border"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Scan with your phone&apos;s camera</p>
                  <p className="text-muted-foreground">It opens Echo&apos;s Contacts on your phone (sign in if asked). Pick one, some or all of your contacts there; they show up here when you import.</p>
                  {url.includes("localhost") && <p className="text-xs text-amber-700 dark:text-amber-300">This is a local address your phone can&apos;t reach. Use echo.redial.si to scan.</p>}
                </div>
              </div>
            )}
            {picker && (
              <Button className="w-full" size="lg" disabled={busy} onClick={openPicker}>{busy ? <Loader2 className="animate-spin" /> : <Users />} Choose from my contacts</Button>
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground hover:bg-muted/40">
              <FileUp className="size-4" /> {phone ? "Choose a .vcf contact file" : "Or upload a .vcf contact file"}
              <input type="file" accept=".vcf,text/vcard,text/x-vcard" multiple className="sr-only"
                onChange={async (e) => { const files = [...(e.target.files ?? [])]; receive(parseVCards((await Promise.all(files.map((f) => f.text()))).join("\n"))); e.target.value = ""; }} />
            </label>
            {phone && !picker && (
              <p className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Smartphone className="size-4 shrink-0" />
                iPhone: in Contacts, tap Lists, touch and hold All Contacts (or any list) → Export, save to Files, then choose that file here. One person: open them → Share Contact. Android: Contacts → Settings → Export.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCandidates(null)}><ArrowLeft /> Back</Button>
              <div className="relative min-w-40 flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="pl-8" aria-label="Search contacts to import" />
              </div>
            </div>
            <label className="flex items-center gap-2 px-1 text-sm">
              <input type="checkbox" checked={allShown} onChange={() => setSelected((s) => { const n = new Set(s); shown.forEach((c) => (allShown ? n.delete(c.key) : n.add(c.key))); return n; })} />
              Select all ({shown.length}) · {selected.size} selected
            </label>
            <ul className="max-h-[45dvh] divide-y overflow-y-auto rounded-xl border">
              {shown.map((c) => (
                <li key={c.key}>
                  <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                    <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{[c.row.first_name, c.row.last_name].filter(Boolean).join(" ")}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[c.row.phone, c.row.email, c.row.company].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    {c.duplicate && <Badge variant="outline" className="shrink-0 text-[10px]">In Echo ({c.duplicate.on})</Badge>}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Add as</span>
              <Button size="sm" variant={role === "contact" ? "secondary" : "ghost"} onClick={() => setRole("contact")}>Contacts</Button>
              <Button size="sm" variant={role === "lead" ? "secondary" : "ghost"} onClick={() => setRole("lead")}>Leads</Button>
            </div>
          </div>
        )}
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{msg.ok ? "Done" : "Cancel"}</Button>
          {candidates && <Button onClick={commit} disabled={pending || selected.size === 0}>{pending ? "Importing…" : `Import ${selected.size}`}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
