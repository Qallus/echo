"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Link2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalDate } from "@/components/local-date";
import { SHARE_PARTS, type SharePart } from "@/lib/share";
import { createShareLink, loadShares, revokeShareLink, shareWithPerson, unsharePerson, type ShareState } from "@/lib/share-actions";

// Share a recording: a public link (choose what it shows and when it expires)
// or named people, who sign in and see it under Shared with me. Owners and
// admins of the workspace can revoke anyone's link or share.

const EXPIRY = [{ days: null, label: "Never" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }] as const;
const partLabel = (p: SharePart) => SHARE_PARTS.find((x) => x.id === p)!.label.split(" and ")[0];

export function ShareDialog({ recordingId, open, onOpenChange, canManage }: {
  recordingId: string; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  const refresh = () => start(async () => {
    try { setState(await loadShares(recordingId)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  });
  useEffect(() => { if (open) refresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Link tab
  const [parts, setParts] = useState<SharePart[]>(["summary", "transcript", "highlights"]);
  const [days, setDays] = useState<number | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toggle = (p: SharePart, on: boolean) => setParts((cur) => (on ? [...cur, p] : cur.filter((x) => x !== p)));
  const create = () => start(async () => {
    setError(undefined); setCopied(false);
    const res = await createShareLink(recordingId, parts, days);
    if (res.error) { setError(res.error); return; }
    setMade(res.url!);
    setState(await loadShares(recordingId));
  });
  const copy = async () => {
    if (!made) return;
    try { await navigator.clipboard.writeText(made); setCopied(true); } catch { setError("Couldn't copy. Select the link and copy it yourself."); }
  };
  const revoke = (id: string) => start(async () => {
    if (!confirm("Turn off this link? Anyone using it will lose access.")) return;
    const res = await revokeShareLink(id);
    if (res.error) setError(res.error); else setState(await loadShares(recordingId));
  });

  // People tab
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string>();
  const invite = () => start(async () => {
    setError(undefined); setNotice(undefined);
    const res = await shareWithPerson(recordingId, email);
    if (res.error) { setError(res.error); return; }
    setNotice(res.notice); setEmail("");
    setState(await loadShares(recordingId));
  });
  const remove = (id: string, who: string) => start(async () => {
    if (!confirm(`Stop sharing with ${who}?`)) return;
    const res = await unsharePerson(id);
    if (res.error) setError(res.error); else setState(await loadShares(recordingId));
  });

  const mine = (by: string | null) => canManage || (!!state && by === state.me);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setMade(null); setNotice(undefined); setError(undefined); } }}>
      <DialogContent title="Share recording" description="Send a link anyone can open, or share with people by email." className="max-w-lg">
        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTrigger value="link"><Link2 /> Link</TabsTrigger>
            <TabsTrigger value="people"><Mail /> People</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 pt-3">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">The link shows</legend>
              {SHARE_PARTS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={parts.includes(p.id)} onCheckedChange={(on) => toggle(p.id, on === true)} /> {p.label}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Expires</span>
              {EXPIRY.map((e) => (
                <button key={e.label} type="button" aria-pressed={days === e.days} onClick={() => setDays(e.days)}
                  className={`rounded-full border px-3 py-1 ${days === e.days ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                  {e.label}
                </button>
              ))}
            </div>
            <Button onClick={create} disabled={busy || parts.length === 0}>{busy ? "Working…" : "Create link"}</Button>

            {made && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex gap-2">
                  <Input readOnly value={made} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="font-mono text-xs" />
                  <Button variant="outline" onClick={copy}>{copied ? <><Check /> Copied</> : <><Copy /> Copy</>}</Button>
                </div>
                <p className="text-xs text-muted-foreground">Copy it now. For security, Echo can&apos;t show this link again; you can always make a new one.</p>
              </div>
            )}

            {state && state.links.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active links</p>
                <ul className="divide-y rounded-lg border text-sm">
                  {state.links.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{l.parts.map(partLabel).join(", ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Made <LocalDate iso={l.createdAt} short /> · {l.views} {l.views === 1 ? "view" : "views"}
                          {l.expiresAt ? <> · expires <LocalDate iso={l.expiresAt} short /></> : " · no expiry"}
                        </p>
                      </div>
                      {mine(l.createdBy) && <Button variant="ghost" size="sm" disabled={busy} onClick={() => revoke(l.id)}>Turn off</Button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="people" className="space-y-4 pt-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); invite(); }}>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-label="Email address" />
              <Button type="submit" disabled={busy || !email.trim()}>Share</Button>
            </form>
            <p className="text-xs text-muted-foreground">They sign in with this email to see the recording, read-only. People without an Echo account get an invite to create a free one.</p>
            {notice && <p className="text-sm">{notice}</p>}
            {state && state.people.length > 0 && (
              <ul className="divide-y rounded-lg border text-sm">
                {state.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate">{p.email}</span>
                    {mine(p.invitedBy) && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Stop sharing with ${p.email}`} disabled={busy} onClick={() => remove(p.id, p.email)}><X /></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
