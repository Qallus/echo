"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { previewTexts, scheduleTexts } from "@/lib/admin/actions/comms-phone";
import type { SmsPreview } from "@/lib/comms/sms-bulk";
import { SMS_KINDS, SMS_PRODUCTS, SMS_TOPICS, STOP_LINE, type SmsKind } from "@/lib/comms/sms-kinds";
import { cn } from "@/lib/utils";
import { Pick } from "./email/pick";

const pad = (n: number) => String(n).padStart(2, "0");
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const KIND_OPTIONS = (Object.keys(SMS_KINDS) as SmsKind[]).map((k) => ({ value: k, label: SMS_KINDS[k].label }));

// A text to waitlist people who agreed to texts, by the kind of message (which
// decides who it reaches, from each person's chosen frequency) and optional
// topic and product. Sends within 5 minutes or at a time you pick.
export function BulkTextDialog({ cronReady, onClose }: { cronReady: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<SmsKind>("major");
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [body, setBody] = useState("");
  const [later, setLater] = useState(false);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("10:00");
  const [preview, setPreview] = useState<SmsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const sendAt = later && date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
  const input = useMemo(() => ({ body, sendAt, audience: { kind, topic: topic || null, products: product ? [product] : [] } }), [body, sendAt, kind, topic, product]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const res = await previewTexts(input).catch(() => ({ error: "Couldn't check who it reaches. Reload the page and try again." }));
      if (!live) return;
      if ("error" in res) { setPreview(null); setError(res.error); } else { setPreview(res); setError(null); }
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [input]);

  const blocked = !preview || preview.sendable === 0 || preview.problems.length > 0;
  const go = () => start(async () => { const res = await scheduleTexts(input); setMsg(res); setConfirming(false); });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Text the waitlist" description="Only people who agreed to texts, following the frequency and topics each person chose." className="max-w-2xl">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Kind of message</Label>
              <Pick label="Kind of message" value={kind} onChange={setKind} options={KIND_OPTIONS} />
              <p className="text-xs text-muted-foreground">{SMS_KINDS[kind].hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Topic</Label><Pick label="Topic" value={topic} onChange={setTopic} options={[{ value: "", label: "Any topic" }, ...SMS_TOPICS]} /></div>
              <div className="space-y-1.5"><Label>Interested in</Label><Pick label="Product" value={product} onChange={setProduct} options={[{ value: "", label: "Echo or Redial" }, ...SMS_PRODUCTS]} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-text">Message</Label>
              <Textarea id="bulk-text" rows={5} maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Redial: Hi {{first_name}}, the beta is open…" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex gap-1">
                  {["{{first_name}}", "{{full_name}}"].map((t) => <button key={t} type="button" onClick={() => setBody(`${body}${t}`)} className="rounded border px-1.5 py-0.5 font-mono hover:bg-muted">{t}</button>)}
                </span>
                <span>{body.length}/1500{preview ? ` · ${preview.segments} segment${preview.segments === 1 ? "" : "s"} each` : ""}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Start with your brand name so people know who it&apos;s from. &ldquo;{STOP_LINE}&rdquo; is added if the message doesn&apos;t mention STOP.</p>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex gap-1" role="group" aria-label="When">
                {[{ v: false, l: "Send now" }, { v: true, l: "Schedule" }].map((o) => (
                  <button key={o.l} type="button" aria-pressed={later === o.v} onClick={() => setLater(o.v)}
                    className={cn("rounded-md px-3 py-1 text-sm", later === o.v ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>{o.l}</button>
                ))}
              </div>
              {later ? (
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker value={date} onChange={setDate} />
                  <TimePicker value={time} onChange={setTime} step={15} aria-label="Time" />
                </div>
              ) : <p className="text-xs text-muted-foreground">Goes out within 5 minutes.</p>}
              <p className="text-[11px] text-muted-foreground">Bulk texts only go out between 8am and 9pm in your business&apos;s time zone.</p>
              {!cronReady && <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />The 5-minute background job isn&apos;t set up (CRON_SECRET), so these won&apos;t go out until it is.</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl bg-muted p-3 text-sm whitespace-pre-wrap break-words">{preview?.body || <span className="text-muted-foreground">Your message appears here as the first person gets it.</span>}</div>
            <div className="rounded-lg border p-3 text-sm">
              {error ? <p className="text-destructive">{error}</p> : !preview ? <p className="text-muted-foreground">Checking who it reaches…</p> : <>
                <p><span className="font-medium">{preview.sendable.toLocaleString()}</span> of {preview.total.toLocaleString()} will get it</p>
                {preview.optedOut > 0 && <p className="text-xs text-muted-foreground">{preview.optedOut} replied STOP, skipped</p>}
                {preview.sample.length > 0 && <p className="mt-1 truncate text-xs text-muted-foreground">{preview.sample.map((x) => x.name || x.phone).join(", ")}</p>}
                {preview.problems.map((p) => <p key={p} className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{p}</p>)}
                <p className="mt-1 text-[11px] text-muted-foreground">People texted too recently for their chosen frequency are skipped when it sends.</p>
              </>}
            </div>
          </div>
        </div>

        {(msg.ok || msg.error) && <p role="status" className={msg.error ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-300"}>{msg.error ?? msg.ok}</p>}
        {confirming && preview ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <span className="mr-auto">Text <span className="font-medium">{preview.sendable.toLocaleString()} {preview.sendable === 1 ? "person" : "people"}</span>{sendAt ? ` on ${new Date(sendAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : " now"}? This can&apos;t be undone once it starts.</span>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Back</Button>
            <Button disabled={pending} onClick={go}>{pending ? "Working…" : "Yes, text them"}</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{msg.ok ? "Done" : "Cancel"}</Button>
            {!msg.ok && <Button disabled={pending || blocked} onClick={() => setConfirming(true)}>{later ? <CalendarClock /> : <Send />} {later ? "Schedule" : "Send"}{preview ? ` to ${preview.sendable.toLocaleString()}` : ""}</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
