"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, MessageSquare, Pencil, Plus, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProtectionData } from "@/lib/redial/data";
import {
  inviteTrustedContact, removeFamilyMember, removeTrustedContact, saveFamilyMember, saveProtection, saveTrustedContact, setCodeWord,
  type FamilyInput, type TrustedInput,
} from "@/lib/redial/protection-actions";
import { cn } from "@/lib/utils";

// Calls -> Protection (the line's owner): scam protection on or off, the
// family code word (write-only: it's never shown again once saved), the family
// members a scammer might pretend to be, and the trusted contacts who hear
// when Redial stops a likely scam.

type Msg = { ok?: string; error?: string };
type Family = ProtectionData["family"][number];
type Trusted = ProtectionData["trusted"][number];
const pretty = (n: string | null) => (n ? n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "");

export function ProtectionSettings({ lineId, data, ownerFirst }: { lineId: string; data: ProtectionData; ownerFirst: string }) {
  const [msg, setMsg] = useState<Msg>({});
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<Msg>) => start(async () => setMsg(await fn()));
  const [editFamily, setEditFamily] = useState<Family | "new" | null>(null);
  const [editTrusted, setEditTrusted] = useState<Trusted | "new" | null>(null);
  const s = data.settings;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5" /> Scam protection</h2>
          <Toggle title="Protect this line" detail="Your assistant checks the story when a caller claims to be family, police, a bank or the government, and stops likely scams before your phone rings."
            checked={s.enabled} disabled={pending} onChange={(enabled) => act(() => saveProtection(lineId, { enabled }))} />
          {s.enabled && (
            <>
              <Toggle title="Block likely scam numbers" detail="When Redial stops a likely scam, that number goes on your block list. You can undo it under Rules."
                checked={s.auto_block_scams} disabled={pending} onChange={(auto_block_scams) => act(() => saveProtection(lineId, { auto_block_scams }))} />
              <Toggle title="Warn about couriers" detail="If a caller mentions sending someone to pick up money or cards, the alert to your trusted contacts says not to open the door."
                checked={s.warn_on_courier} disabled={pending} onChange={(warn_on_courier) => act(() => saveProtection(lineId, { warn_on_courier }))} />
            </>
          )}
        </section>

        {s.enabled && (
          <>
            <CodeWord lineId={lineId} isSet={s.has_code_word} onResult={setMsg} />

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5" /> Family</h2>
                  <p className="text-sm text-muted-foreground">The people a scammer might pretend to be. With their number and permission, Redial can call them to check they&apos;re safe while a caller holds.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditFamily("new")}><Plus /> Add family member</Button>
              </div>
              {data.family.length === 0 ? <Empty text="No family members yet. Add the grandchildren and children a scammer might claim to be." /> : (
                <ul className="divide-y rounded-xl border bg-card">
                  {data.family.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-3 p-3">
                      <span className="grid size-9 place-items-center rounded-full bg-muted"><UserRound className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{f.name}{f.relationship ? <span className="font-normal text-muted-foreground"> · {f.relationship}</span> : null}</span>
                        <span className="block text-xs text-muted-foreground">{f.phone ? pretty(f.phone) : "No number"}{f.phone && f.callback_ok ? " · Redial may call to check" : f.phone ? " · No call-back checks" : ""}</span>
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.name}`} onClick={() => setEditFamily(f)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f.name}`} disabled={pending} onClick={() => { if (confirm(`Remove ${f.name}?`)) act(() => removeFamilyMember(f.id)); }}><Trash2 /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageSquare className="size-5" /> Trusted contacts</h2>
                  <p className="text-sm text-muted-foreground">Who hears when Redial stops a likely scam, and (if they like) gets a short weekly summary. Texts start only after they reply YES to the invite.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditTrusted("new")}><Plus /> Add trusted contact</Button>
              </div>
              {data.trusted.length === 0 ? <Empty text="No trusted contacts yet. A son, daughter or caregiver is a good choice." /> : (
                <ul className="divide-y rounded-xl border bg-card">
                  {data.trusted.map((t) => {
                    const st = trustedStatus(t);
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{t.name}</span>
                            <Badge variant="outline" className={st.tone}>{st.label}</Badge>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {[pretty(t.phone), t.email].filter(Boolean).join(" · ")}
                            {` · ${[t.alert_scams && "scam alerts", t.weekly_summary && "weekly summary"].filter(Boolean).join(" and ") || "nothing turned on"}`}
                          </span>
                        </span>
                        {t.phone && !t.sms_consent_at && !t.opted_out_at && (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => inviteTrustedContact(t.id))}><MessageSquare /> {t.invited_at ? "Invite again" : "Send invite"}</Button>
                        )}
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditTrusted(t)}><Pencil /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${t.name}`} disabled={pending} onClick={() => { if (confirm(`Remove ${t.name}? They'll stop getting alerts.`)) act(() => removeTrustedContact(t.id)); }}><Trash2 /></Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
        {(msg.ok || msg.error) && <p className={msg.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.error ?? msg.ok}</p>}
      </div>

      <aside className="h-fit space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
          <li>Your assistant answers unknown callers before your phone rings.</li>
          <li>If someone says they&apos;re family or in trouble, it asks for the code word, and can call that person to check they&apos;re safe.</li>
          <li>Likely scams end politely, never ring {ownerFirst === "you" ? "you" : ownerFirst}, and the number is blocked.</li>
          <li>Your trusted contacts get a text or email right away.</li>
        </ol>
        <p className="pt-1 text-xs text-muted-foreground">Redial helps verify callers and flags likely scams; no system catches every one.</p>
      </aside>

      <EditSheet open={editFamily !== null} onClose={() => setEditFamily(null)}
        title={editFamily === "new" ? "Add a family member" : "Edit family member"} description="Someone a scammer might pretend to be.">
        {editFamily !== null && <FamilyForm key={editFamily === "new" ? "new" : editFamily.id} lineId={lineId} row={editFamily === "new" ? null : editFamily}
          onDone={(m) => { setMsg(m); if (m.ok) setEditFamily(null); }} />}
      </EditSheet>
      <EditSheet open={editTrusted !== null} onClose={() => setEditTrusted(null)}
        title={editTrusted === "new" ? "Add a trusted contact" : "Edit trusted contact"} description="They hear when Redial stops a likely scam.">
        {editTrusted !== null && <TrustedForm key={editTrusted === "new" ? "new" : editTrusted.id} lineId={lineId} row={editTrusted === "new" ? null : editTrusted}
          onDone={(m) => { setMsg(m); if (m.ok) setEditTrusted(null); }} />}
      </EditSheet>
    </div>
  );
}

function trustedStatus(t: Trusted): { label: string; tone: string } {
  if (t.opted_out_at) return { label: "Opted out", tone: "text-muted-foreground" };
  if (t.sms_consent_at) return { label: "Getting texts", tone: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" };
  if (t.invited_at) return { label: "Invited · waiting for YES", tone: "border-amber-500/40 text-amber-700 dark:text-amber-400" };
  if (!t.phone && t.email) return { label: "Email only", tone: "border-sky-500/40 text-sky-700 dark:text-sky-400" };
  return { label: "Not invited yet", tone: "text-muted-foreground" };
}

function Toggle({ title, detail, checked, disabled, onChange }: { title: string; detail: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
      <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</p>;

// Write-only: the saved word is never sent back to the browser.
function CodeWord({ lineId, isSet, onResult }: { lineId: string; isSet: boolean; onResult: (m: Msg) => void }) {
  const [editing, setEditing] = useState(!isSet);
  const [word, setWord] = useState("");
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const save = (w: string) => start(async () => { const r = await setCodeWord(lineId, w); onResult(r); if (r.ok) { setWord(""); setEditing(!w); } });
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5" /> Family code word</h2>
      <p className="text-sm text-muted-foreground">A word only your family knows. When a caller says they&apos;re family, your assistant asks for it. Your assistant never knows the word itself; Redial checks the answer.</p>
      {!editing ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
          <span className="font-mono tracking-widest">••••••••</span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Set</Badge>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Change</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm("Remove the code word?")) save(""); }}>Remove</Button>
        </div>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (word.trim()) save(word); }}>
          <div className="relative w-full max-w-xs">
            <Input type={show ? "text" : "password"} value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. bluebird" autoComplete="off" maxLength={40} aria-label="Code word" className="pr-9" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide" : "Show"} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
          <Button type="submit" size="sm" disabled={pending || word.trim().length < 2}>{pending ? "Saving…" : "Save code word"}</Button>
          {isSet && <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setWord(""); }}>Cancel</Button>}
          <p className="w-full text-xs text-muted-foreground">Pick something easy to say and hard to guess. Share it with family by phone or in person, never by text or email.</p>
        </form>
      )}
    </section>
  );
}

// A side sheet on larger screens, a bottom sheet on phones.
function EditSheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description: string; children: React.ReactNode }) {
  const mobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn(mobile ? "max-h-[90dvh] rounded-t-2xl" : "w-full sm:max-w-md")}>
        {mobile && <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />}
        <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function FamilyForm({ lineId, row, onDone }: { lineId: string; row: Family | null; onDone: (m: Msg) => void }) {
  const [f, setF] = useState<FamilyInput>({ name: row?.name ?? "", relationship: row?.relationship ?? "", phone: pretty(row?.phone ?? null), callback_ok: row?.callback_ok ?? true });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveFamilyMember(lineId, row?.id ?? null, f); if (r.error) setError(r.error); else onDone(r); }); }}>
      <Field label="Name"><Input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tyler Waters" /></Field>
      <Field label="Relationship"><Input maxLength={40} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })} placeholder="Grandson" /></Field>
      <Field label="Their mobile number" hint="Needed for call-back checks.">
        <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(480) 555-0142" />
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <span><span className="block text-sm font-medium">Redial may call them to check</span><span className="block text-xs text-muted-foreground">While a caller who claims to be them holds, Redial calls this number and asks them to press 1 if they&apos;re safe.</span></span>
        <Switch checked={f.callback_ok} onCheckedChange={(callback_ok) => setF({ ...f, callback_ok })} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <SheetFooter className="px-0"><Button type="submit" disabled={pending}>{pending ? "Saving…" : row ? "Save" : "Add family member"}</Button></SheetFooter>
    </form>
  );
}

function TrustedForm({ lineId, row, onDone }: { lineId: string; row: Trusted | null; onDone: (m: Msg) => void }) {
  const [f, setF] = useState<TrustedInput>({ name: row?.name ?? "", phone: pretty(row?.phone ?? null), email: row?.email ?? "", alert_scams: row?.alert_scams ?? true, weekly_summary: row?.weekly_summary ?? true });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveTrustedContact(lineId, row?.id ?? null, f); if (r.error) setError(r.error); else onDone(r); }); }}>
      <Field label="Name"><Input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sarah Waters" /></Field>
      <Field label="Mobile number" hint="They get a text invite and reply YES to start."><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(480) 555-0142" /></Field>
      <Field label="Email" hint="Optional. Alerts by email don't need a reply."><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="sarah@example.com" /></Field>
      <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <span className="text-sm font-medium">Alert them when a scam is stopped</span>
        <Switch checked={f.alert_scams} onCheckedChange={(alert_scams) => setF({ ...f, alert_scams })} />
      </label>
      <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <span><span className="block text-sm font-medium">Weekly summary</span><span className="block text-xs text-muted-foreground">Sundays: how many calls rang through, left messages or were stopped.</span></span>
        <Switch checked={f.weekly_summary} onCheckedChange={(weekly_summary) => setF({ ...f, weekly_summary })} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <SheetFooter className="px-0"><Button type="submit" disabled={pending}>{pending ? "Saving…" : row ? "Save" : "Add trusted contact"}</Button></SheetFooter>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
