"use client";

import { useState, useTransition } from "react";
import { ImageUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CardFace } from "@/components/cards/card-face";
import { saveCard } from "@/lib/admin/actions/cards";
import { slugify, type Card, type CardLink } from "@/lib/cards/types";
import type { StaffOption } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SELECT } from "@/components/admin/crm/crm-ui";

const ACCENTS = ["#18181b", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#16a34a", "#0891b2"];
type Draft = Omit<Card, "id" | "created_at" | "updated_at"> & { id?: string };

export const blankCard = (owner: string | null): Draft => ({
  slug: "", owner_id: owner, full_name: "", title: "", company: "", bio: "", email: "", phone: "", website: "", address: "",
  photo_url: null, logo_url: null, accent: "#18181b", theme: "light", links: [], lead_capture: true, active: true,
});

// Create or edit a card with a live preview beside the form.
export function CardBuilder({ card, staff, canAssign, onClose }: { card: Draft; staff: StaffOption[]; canAssign: boolean; onClose: () => void }) {
  const [d, setD] = useState<Draft>(card);
  const [slugTouched, setSlugTouched] = useState(Boolean(card.id));
  const [uploading, setUploading] = useState<"photo_url" | "logo_url" | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setLink = (i: number, patch: Partial<CardLink>) => set("links", d.links.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function upload(field: "photo_url" | "logo_url", file: File) {
    if (file.size > 5 * 1024 * 1024) { setMsg({ error: "Images can be up to 5 MB." }); return; }
    setUploading(field);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
    const path = `${d.id ?? "new"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("cards").upload(path, file, { contentType: file.type, upsert: false });
    if (error) setMsg({ error: error.message });
    else set(field, supabase.storage.from("cards").getPublicUrl(path).data.publicUrl);
    setUploading(null);
  }

  const preview = { ...d, full_name: d.full_name || "Your name", links: d.links.filter((l) => l.label && l.url) };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-5xl">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <form className="space-y-5 p-5" onSubmit={(e) => {
            e.preventDefault();
            start(async () => { const r = await saveCard(d); setMsg(r); if (!r.error) onClose(); });
          }}>
            <SheetTitle className="pt-4">{d.id ? "Edit card" : "New business card"}</SheetTitle>

            <section className="grid gap-3 sm:grid-cols-2">
              <Field id="bc-name" label="Name"><Input id="bc-name" required value={d.full_name} onChange={(e) => { set("full_name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} /></Field>
              <Field id="bc-slug" label="Card link" hint={`/card/${d.slug || "your-name"}`}>
                <Input id="bc-slug" required value={d.slug} pattern="[a-z0-9][a-z0-9\-]{1,59}" onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} />
              </Field>
              <Field id="bc-title" label="Title"><Input id="bc-title" value={d.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Founder" /></Field>
              <Field id="bc-company" label="Company"><Input id="bc-company" value={d.company ?? ""} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field id="bc-email" label="Email"><Input id="bc-email" type="email" value={d.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field id="bc-phone" label="Phone"><PhoneInput id="bc-phone" value={d.phone ?? ""} onChange={(v) => set("phone", v)} /></Field>
              <Field id="bc-web" label="Website"><Input id="bc-web" value={d.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="example.com" /></Field>
              <Field id="bc-addr" label="Address"><Input id="bc-addr" value={d.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field id="bc-bio" label="About"><Textarea id="bc-bio" rows={3} maxLength={1000} value={d.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></Field></div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              {(["photo_url", "logo_url"] as const).map((f) => (
                <div key={f} className="space-y-1.5">
                  <Label>{f === "photo_url" ? "Photo" : "Logo"}</Label>
                  <div className="flex items-center gap-2">
                    <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted", uploading === f && "pointer-events-none opacity-60")}>
                      {uploading === f ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} Upload
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(f, file); e.target.value = ""; }} />
                    </label>
                    {d[f] && <Button type="button" size="sm" variant="ghost" onClick={() => set(f, null)}>Remove</Button>}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <Label>Links</Label>
              {d.links.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label="Link label" placeholder="LinkedIn" className="w-36" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                  <Input aria-label="Link address" placeholder="linkedin.com/in/you" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove link" onClick={() => set("links", d.links.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              {d.links.length < 12 && <Button type="button" size="sm" variant="outline" onClick={() => set("links", [...d.links, { label: "", url: "" }])}><Plus /> Add link</Button>}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Accent color</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ACCENTS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set("accent", c)} className={cn("size-7 rounded-full border-2", d.accent === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />)}
                  <input type="color" aria-label="Custom color" value={d.accent} onChange={(e) => set("accent", e.target.value)} className="size-7 cursor-pointer rounded-full border bg-transparent" />
                </div>
              </div>
              <Field id="bc-theme" label="Card style">
                <select id="bc-theme" className={SELECT} value={d.theme} onChange={(e) => set("theme", e.target.value as Draft["theme"])}><option value="light">Light</option><option value="dark">Dark</option></select>
              </Field>
              {canAssign && (
                <Field id="bc-owner" label="Belongs to" hint="New contacts from this card go to this person.">
                  <select id="bc-owner" className={SELECT} value={d.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value || null)}>
                    <option value="">No one</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                  </select>
                </Field>
              )}
              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between gap-3 text-sm">Visitors can share their details<Switch checked={d.lead_capture} onCheckedChange={(v) => set("lead_capture", v)} /></label>
                <label className="flex items-center justify-between gap-3 text-sm">Card is live<Switch checked={d.active} onCheckedChange={(v) => set("active", v)} /></label>
              </div>
            </section>

            {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || Boolean(uploading)}>{pending ? "Saving…" : d.id ? "Save card" : "Create card"}</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </form>
          <div className="border-t bg-muted/40 p-5 lg:border-t-0 lg:border-l">
            <p className="pb-3 text-xs font-medium text-muted-foreground">Preview</p>
            <CardFace card={preview} className="pointer-events-none" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
