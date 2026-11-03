"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, GalleryHorizontal, Image as ImageIcon, Link as LinkIcon, Loader2, PlayCircle, Plus, QrCode, Trash2, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useQr } from "@/components/cards/card-preview";
import {
  COLOR_PRESETS, DEFAULT_LOGO_HEIGHT, DEFAULT_LOGO_MARGIN_BOTTOM, DEFAULT_QR_DISPLAY, LINK_TYPES, slugify, uid,
  type AutomationAction, type CardDesign, type CardLink, type CardSection, type LinkType, type MediaSettings, type SectionType, type Slide, type StepItem,
} from "@/lib/cards/types";
import type { StaffOption } from "@/lib/crm/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SELECT } from "@/components/admin/crm/crm-ui";
import type { Draft, SetDraft } from "./card-builder";
import { NfcWriter } from "./nfc";

export type PanelKey = "sections" | "content" | "links" | "color" | "splash" | "qr" | "forms" | "nfc" | "media" | "slideshow" | "steps" | "automate" | "settings" | "wizard";
type SetDesign = (fn: (d: CardDesign) => CardDesign) => void;
type P = { draft: Draft; setDraft: SetDraft; setDesign: SetDesign };

// ── Field helpers ──────────────────────────────────────────────────────────────

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {intro && <p className="mb-3 text-xs text-muted-foreground">{intro}</p>}
      {children}
    </section>
  );
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <label className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">{label}<Switch checked={on} onCheckedChange={onChange} /></label>;
}
function Range({ label, value, min, max, step = 1, onChange, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: string }) {
  return <F label={label} hint={hint}><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-primary" /></F>;
}
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition", value === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
      ))}
    </div>
  );
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <F label={label}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 cursor-pointer rounded-md border bg-transparent" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </F>
  );
}

async function upload(file: File, kind: "image" | "video"): Promise<{ url?: string; error?: string }> {
  const max = kind === "image" ? 5 : 100;
  if (file.size > max * 1024 * 1024) return { error: `${kind === "image" ? "Images" : "Videos"} can be up to ${max} MB.` };
  const supabase = createClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `uploads/${uid()}.${ext}`;
  const { error } = await supabase.storage.from("cards").upload(path, file, { contentType: file.type, upsert: false });
  return error ? { error: error.message } : { url: supabase.storage.from("cards").getPublicUrl(path).data.publicUrl };
}

function ImageField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <F label={label}>
      <div className="flex items-center gap-2">
        {value ? <img src={value} alt="" className="size-10 rounded-md object-cover" /> : <div className="grid size-10 place-items-center rounded-md bg-muted text-muted-foreground"><ImageIcon className="size-4" /></div>} {/* eslint-disable-line @next/next/no-img-element */}
        <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted", busy && "pointer-events-none opacity-60")}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Uploading…" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            setBusy(true); const r = await upload(f, "image"); setBusy(false);
            setError(r.error); if (r.url) onChange(r.url);
          }} />
        </label>
        {value && <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(null)}>Remove</Button>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </F>
  );
}

// Sections live in the design; these helpers find or add one by type.
const blankSection = (section_type: SectionType, label: string, content: Record<string, unknown> = {}): CardSection =>
  ({ id: uid(), section_type, label, content, is_visible: true, margin_top: 0, margin_bottom: 16 });
function useSection(p: P, type: SectionType, label: string) {
  const section = p.draft.design.sections.find((s) => s.section_type === type);
  const update = (fn: (s: CardSection) => CardSection) => p.setDesign((d) => {
    const has = d.sections.some((s) => s.section_type === type);
    const list = has ? d.sections : type === "opener" ? [blankSection(type, label), ...d.sections] : [...d.sections, blankSection(type, label)];
    return { ...d, sections: list.map((s) => (s.section_type === type ? fn(s) : s)) };
  });
  const setContent = (patch: Record<string, unknown>) => update((s) => ({ ...s, content: { ...s.content, ...patch } }));
  return { section, update, setContent };
}

// ── Panels ─────────────────────────────────────────────────────────────────────

export function PanelBody(props: P & { panel: PanelKey; staff: StaffOption[]; canAssign: boolean; publicUrl: string }) {
  const { panel, draft, setDraft, setDesign } = props;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  switch (panel) {
    case "sections": return <SectionsPanel {...props} />;
    case "content": return (
      <>
        <Section title="Profile">
          <ImageField label="Profile photo" value={draft.profile_photo_url} onChange={(v) => set("profile_photo_url", v)} />
          <ImageField label="Logo (optional)" value={draft.logo_url} onChange={(v) => set("logo_url", v)} />
          {draft.logo_url && <LogoControls {...props} />}
          <F label="Display name"><Input value={draft.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="Jordan Lee" /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label="First name"><Input value={draft.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></F>
            <F label="Last name"><Input value={draft.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></F>
          </div>
          <F label="Job title"><Input value={draft.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} /></F>
          <F label="Company"><Input value={draft.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></F>
          <F label="Department"><Input value={draft.department ?? ""} onChange={(e) => set("department", e.target.value)} /></F>
          <F label="Bio"><Textarea rows={3} maxLength={1000} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></F>
        </Section>
        <Section title="Contact">
          <F label="Phone"><PhoneInput value={draft.primary_phone ?? ""} onChange={(v) => set("primary_phone", v)} /></F>
          <F label="Text (SMS) number" hint="Leave blank to use the phone number."><PhoneInput value={draft.sms_phone ?? ""} onChange={(v) => set("sms_phone", v)} /></F>
          <F label="Email"><Input type="email" value={draft.primary_email ?? ""} onChange={(e) => set("primary_email", e.target.value)} /></F>
          <F label="Website"><Input value={draft.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} placeholder="example.com" /></F>
          <F label="Address"><Input value={draft.address ?? ""} onChange={(e) => set("address", e.target.value)} /></F>
          <F label="Map link (optional)" hint="Leave blank to open the address in Google Maps."><Input value={draft.maps_url ?? ""} onChange={(e) => set("maps_url", e.target.value)} /></F>
          <F label="Intro video link"><Input value={draft.intro_video_url ?? ""} onChange={(e) => set("intro_video_url", e.target.value)} placeholder="YouTube or Vimeo link" /></F>
        </Section>
      </>
    );
    case "links": return <LinksPanel {...props} />;
    case "color": return (
      <Section title="Colors & theme">
        <F label="Theme"><Segmented value={draft.theme_mode} options={[["light", "Light"], ["dark", "Dark"], ["both", "Visitor picks"]]} onChange={(v) => set("theme_mode", v)} /></F>
        <F label="Presets">
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((p) => (
              <button key={p.name} type="button" onClick={() => setDraft((d) => ({ ...d, background_color: p.bg, accent_color: p.accent, text_color: p.text }))} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs hover:bg-muted">
                <span className="size-3 rounded-full" style={{ background: p.bg, border: `2px solid ${p.accent}` }} />{p.name}
              </button>
            ))}
          </div>
        </F>
        <ColorField label="Background" value={draft.background_color} onChange={(v) => set("background_color", v)} />
        <ColorField label="Accent" value={draft.accent_color} onChange={(v) => set("accent_color", v)} />
        <ColorField label="Text" value={draft.text_color} onChange={(v) => set("text_color", v)} />
      </Section>
    );
    case "splash": return <SplashPanel {...props} />;
    case "qr": return <QrPanel {...props} />;
    case "forms": {
      const lf = draft.design.lead_form_settings;
      const setLF = (patch: Partial<typeof lf>) => setDesign((d) => ({ ...d, lead_form_settings: { ...d.lead_form_settings, ...patch } }));
      return (
        <Section title="Lead capture form" intro="Visitors send you their details. They're added to Contacts as a lead you own, and you're notified.">
          <Toggle label="Show “Send me your info”" on={lf.enabled} onChange={(v) => setLF({ enabled: v })} />
          <F label="Title"><Input value={lf.title} onChange={(e) => setLF({ title: e.target.value })} /></F>
          <F label="Description"><Input value={lf.description} onChange={(e) => setLF({ description: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label="Button on card"><Input value={lf.button_label} onChange={(e) => setLF({ button_label: e.target.value })} /></F>
            <F label="Submit button"><Input value={lf.submit_label} onChange={(e) => setLF({ submit_label: e.target.value })} /></F>
          </div>
          <F label="Fields" hint="Name and an email or phone number are always needed to save the lead.">
            <div className="space-y-1.5">
              {lf.fields.map((f, i) => (
                <div key={f.key} className="flex items-center gap-3 rounded-md border bg-card px-2.5 py-1.5 text-sm">
                  <span className="flex-1">{f.label}</span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={f.enabled} onChange={(e) => setLF({ fields: lf.fields.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) })} /> Show</label>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={f.required} onChange={(e) => setLF({ fields: lf.fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })} /> Required</label>
                </div>
              ))}
            </div>
          </F>
        </Section>
      );
    }
    case "nfc": return <NfcPanel {...props} />;
    case "slideshow": return <SlideshowPanel {...props} />;
    case "media": return <MediaPanel {...props} />;
    case "steps": return <StepsPanel {...props} />;
    case "automate": return <AutomationsPanel {...props} />;
    case "settings": return (
      <Section title="Card settings">
        <F label="Card name (internal)"><Input value={draft.card_name ?? ""} onChange={(e) => set("card_name", e.target.value)} /></F>
        <F label="Card link" hint="Leave blank to make one from the display name.">
          <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground">/card/</span><Input value={draft.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="auto" /></div>
        </F>
        <F label="Status">
          <select className={SELECT} value={draft.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
            <option value="draft">Draft</option><option value="published">Published</option><option value="unpublished">Unpublished</option><option value="archived">Archived</option>
          </select>
        </F>
        {props.canAssign && (
          <F label="Belongs to" hint="New leads from this card are assigned to this person.">
            <select className={SELECT} value={draft.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value || null)}>
              <option value="">No one</option>{props.staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name} ({s.email})</option>)}
            </select>
          </F>
        )}
      </Section>
    );
    case "wizard": {
      const steps = [
        [Boolean(draft.display_name), "Add your name and title", "content"], [Boolean(draft.profile_photo_url), "Upload a profile photo", "content"],
        [Boolean(draft.primary_phone || draft.primary_email), "Add contact details", "content"], [draft.links.length > 0 || Boolean(draft.website_url), "Add at least one link", "links"],
        [draft.design.lead_form_settings.enabled, "Turn on lead capture", "forms"], [draft.status === "published", "Publish your card", "settings"],
      ] as const;
      return (
        <Section title="Setup wizard" intro="Finish these for a polished card you can share.">
          {steps.map(([ok, label], i) => (
            <div key={label} className="mb-2 flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", ok ? "bg-emerald-500 text-white" : "border text-muted-foreground")}>{ok ? "✓" : i + 1}</span>
              <span className={cn(ok && "text-muted-foreground line-through")}>{label}</span>
            </div>
          ))}
        </Section>
      );
    }
  }
}

function SectionsPanel({ draft, setDesign }: P) {
  const list = draft.design.sections;
  const patch = (id: string, p: Partial<CardSection>) => setDesign((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const move = (i: number, dir: -1 | 1) => setDesign((d) => {
    const j = i + dir;
    if (j < 0 || j >= d.sections.length) return d;
    const next = d.sections.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return { ...d, sections: next };
  });
  return (
    <Section title="Sections & layers" intro="Show, hide, reorder and space the sections on your card.">
      {list.map((s, i) => (
        <div key={s.id} className="mb-2 rounded-lg border bg-card p-2.5">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-sm font-medium">{s.label}</span>
            <Button size="icon-xs" variant="ghost" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Move ${s.label} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}><ChevronDown /></Button>
            <Button size="icon-xs" variant="ghost" aria-label={s.is_visible ? `Hide ${s.label}` : `Show ${s.label}`} onClick={() => patch(s.id, { is_visible: !s.is_visible })} className={s.is_visible ? "" : "text-muted-foreground"}>
              {s.is_visible ? <Eye /> : <EyeOff />}
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Space below</span>
            <input type="range" min={0} max={48} value={s.margin_bottom} onChange={(e) => patch(s.id, { margin_bottom: Number(e.target.value) })} className="flex-1 accent-primary" aria-label={`Space below ${s.label}`} />
            <span className="w-8 text-right text-[11px] text-muted-foreground">{s.margin_bottom}</span>
          </div>
        </div>
      ))}
    </Section>
  );
}

function LinksPanel({ draft, setDraft }: P) {
  const setLinks = (fn: (l: CardLink[]) => CardLink[]) => setDraft((d) => ({ ...d, links: fn(d.links) }));
  const update = (id: string, p: Partial<CardLink>) => setLinks((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) => setLinks((l) => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = l.slice(); [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <Section title="Links & socials" intro="Buttons in the Links section of your card.">
      {draft.links.map((l, i) => (
        <div key={l.id} className="mb-2 space-y-2 rounded-lg border bg-card p-2.5">
          <div className="flex items-center gap-1">
            <Input value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} placeholder="Label" aria-label="Link label" />
            <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></Button>
            <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === draft.links.length - 1} onClick={() => move(i, 1)}><ChevronDown /></Button>
            <Button size="icon-xs" variant="ghost" aria-label={l.is_visible ? "Hide" : "Show"} onClick={() => update(l.id, { is_visible: !l.is_visible })}>{l.is_visible ? <Eye /> : <EyeOff />}</Button>
            <Button size="icon-xs" variant="ghost" aria-label="Delete link" className="text-destructive" onClick={() => setLinks((x) => x.filter((y) => y.id !== l.id))}><Trash2 /></Button>
          </div>
          <Input value={l.url} onChange={(e) => update(l.id, { url: e.target.value })} placeholder="https://…" aria-label="Link address" />
          <div className="flex items-center gap-2">
            <select className={SELECT} value={l.link_type} onChange={(e) => update(l.id, { link_type: e.target.value as LinkType })} aria-label="Link type">
              {LINK_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={l.open_in_new_tab} onChange={(e) => update(l.id, { open_in_new_tab: e.target.checked })} /> New tab</label>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setLinks((l) => [...l, { id: uid(), label: "New link", url: "", link_type: "custom", is_visible: true, open_in_new_tab: true }])}><Plus /> Add link</Button>
    </Section>
  );
}

function LogoControls({ draft, setDesign }: P) {
  const m = draft.design.media_settings;
  const setMedia = (p: Partial<MediaSettings>) => setDesign((d) => ({ ...d, media_settings: { ...d.media_settings, ...p } }));
  return (
    <div className="mb-3 rounded-lg border bg-muted/30 p-3">
      <Range label={`Logo size: ${m.logo_height || DEFAULT_LOGO_HEIGHT}px`} hint="The aspect ratio is kept." value={m.logo_height || DEFAULT_LOGO_HEIGHT} min={16} max={160} onChange={(v) => setMedia({ logo_height: v })} />
      <Range label={m.logo_width ? `Max width: ${m.logo_width}px` : "Max width: auto"} value={m.logo_width || 0} min={0} max={320} onChange={(v) => setMedia({ logo_width: v })} />
      <F label="Position"><Segmented value={m.logo_align ?? (m.content_align === "left" ? "left" : "center")} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => setMedia({ logo_align: v })} /></F>
      <Range label={`Padding: ${m.logo_padding || 0}px`} value={m.logo_padding || 0} min={0} max={48} onChange={(v) => setMedia({ logo_padding: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Range label={`Space above: ${m.logo_margin_top || 0}px`} value={m.logo_margin_top || 0} min={0} max={48} onChange={(v) => setMedia({ logo_margin_top: v })} />
        <Range label={`Space below: ${m.logo_margin_bottom ?? DEFAULT_LOGO_MARGIN_BOTTOM}px`} value={m.logo_margin_bottom ?? DEFAULT_LOGO_MARGIN_BOTTOM} min={0} max={48} onChange={(v) => setMedia({ logo_margin_bottom: v })} />
      </div>
      <F label="Logo links to (optional)"><Input value={m.logo_link_url ?? ""} onChange={(e) => setMedia({ logo_link_url: e.target.value })} placeholder="https://…" /></F>
    </div>
  );
}

function MediaPanel(p: P) {
  const { draft, setDraft, setDesign } = p;
  const m = draft.design.media_settings;
  const setMedia = (x: Partial<MediaSettings>) => setDesign((d) => ({ ...d, media_settings: { ...d.media_settings, ...x } }));
  return (
    <>
      <Section title="Background">
        <ImageField label="Background image" value={draft.background_image_url} onChange={(v) => setDraft((d) => ({ ...d, background_image_url: v }))} />
        <Toggle label="Use the background image (with a tint)" on={Boolean(m.use_background_image)} onChange={(v) => setMedia({ use_background_image: v })} />
      </Section>
      <Section title="Profile photo">
        <F label="Shape"><Segmented value={m.profile_shape ?? "circle"} options={[["circle", "Circle"], ["rounded", "Rounded"], ["square", "Square"]]} onChange={(v) => setMedia({ profile_shape: v })} /></F>
        <Toggle label="Outline around the photo" on={Boolean(m.profile_outline)} onChange={(v) => setMedia({ profile_outline: v })} />
        {m.profile_outline && <ColorField label="Outline color" value={m.profile_outline_color || draft.accent_color} onChange={(v) => setMedia({ profile_outline_color: v })} />}
        <F label="Photo links to (optional)" hint="e.g. your booking page."><Input value={m.profile_link_url ?? ""} onChange={(e) => setMedia({ profile_link_url: e.target.value })} placeholder="https://…" /></F>
      </Section>
      <Section title="Layout">
        <F label="Alignment"><Segmented value={m.content_align ?? "center"} options={[["center", "Centered"], ["left", "Left"]]} onChange={(v) => setMedia({ content_align: v })} /></F>
      </Section>
    </>
  );
}

function QrPanel({ draft, setDesign, publicUrl }: P & { publicUrl: string }) {
  const qr = draft.design.qr_settings;
  const px = qr.display_size || DEFAULT_QR_DISPLAY;
  const fg = qr.foreground || "#000000";
  const setQr = (x: Partial<typeof qr>) => setDesign((d) => ({ ...d, qr_settings: { ...d.qr_settings, ...x } }));
  const preview = useQr(`${publicUrl}?src=qr`, Math.max(320, px * 2), fg);
  const big = useQr(`${publicUrl}?src=qr`, 1024, fg);
  return (
    <Section title="QR code" intro="The code opens your public card. Save the card first so the link is final.">
      <div className="mb-3 flex justify-center rounded-lg border bg-white p-4">{preview && <img src={preview} alt="QR code" style={{ width: px, height: px }} />}</div> {/* eslint-disable-line @next/next/no-img-element */}
      <F label={`Size on card: ${px}px`} hint="Only changes how big it shows. Downloads stay full size.">
        <div className="mb-2"><Segmented value={String(px)} options={[["96", "Small"], ["128", "Medium"], ["176", "Large"]]} onChange={(v) => setQr({ display_size: Number(v) })} /></div>
        <input type="range" min={80} max={240} step={4} value={px} onChange={(e) => setQr({ display_size: Number(e.target.value) })} className="w-full accent-primary" aria-label="QR size" />
      </F>
      <ColorField label="QR color" value={fg} onChange={(v) => setQr({ foreground: v })} />
      <Button size="sm" variant="outline" className="w-full" disabled={!big} render={<a href={big ?? "#"} download={`${draft.slug || "card"}-qr.png`} />} nativeButton={false}><QrCode /> Download PNG</Button>
    </Section>
  );
}

function NfcPanel(p: P & { publicUrl: string }) {
  const { draft, setDraft } = p;
  const nfcUrl = `${p.publicUrl}?src=nfc`;
  const { section, update } = useSection(p, "nfc", "NFC tap to share");
  return (
    <Section title="NFC tap to share" intro="Program an NFC tag or card to open this link. Taps are counted as NFC visits.">
      <F label="Status">
        <select className={SELECT} value={draft.nfc_status} onChange={(e) => setDraft((d) => ({ ...d, nfc_status: e.target.value as Draft["nfc_status"] }))}>
          <option value="not_ordered">Not ordered</option><option value="ordered">Ordered</option><option value="assigned">Linked to a tag</option><option value="active">Active</option>
        </select>
      </F>
      <F label="Tag link">
        <div className="flex items-center gap-2"><Input readOnly value={nfcUrl} className="font-mono text-xs" /><Button size="icon-sm" variant="outline" aria-label="Copy tag link" onClick={() => void navigator.clipboard.writeText(nfcUrl)}><Copy /></Button></div>
      </F>
      <NfcWriter url={nfcUrl} onWritten={() => setDraft((d) => ({ ...d, nfc_status: "active" }))} />
      <div className="mt-4"><Toggle label="Show a “tap to share” note on the card" on={Boolean(section?.is_visible)} onChange={(v) => update((s) => ({ ...s, is_visible: v }))} /></div>
    </Section>
  );
}

function SlideEditor({ slides, onChange }: { slides: Slide[]; onChange: (s: Slide[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [urls, setUrls] = useState("");
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= slides.length) return; const n = slides.slice(); [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted", busy && "pointer-events-none opacity-60")}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Uploading…" : "Upload images"}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => {
            const files = [...(e.target.files ?? [])]; e.target.value = "";
            setBusy(true);
            const added: Slide[] = [];
            for (const f of files) { const r = await upload(f, "image"); if (r.url) added.push({ id: uid(), image_url: r.url, caption: "" }); else setError(r.error); }
            setBusy(false);
            if (added.length) onChange([...slides, ...added]);
          }} />
        </label>
        <span className="text-xs text-muted-foreground">{slides.length} image{slides.length === 1 ? "" : "s"}</span>
      </div>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="mb-3 flex gap-2">
        <Input placeholder="Or paste image links" value={urls} onChange={(e) => setUrls(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!urls.trim()} onClick={() => { onChange([...slides, ...urls.split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u)).map((u) => ({ id: uid(), image_url: u, caption: "" }))]); setUrls(""); }}><Plus /> Add</Button>
      </div>
      {slides.map((sl, i) => (
        <div key={sl.id} className="mb-2 flex items-center gap-2 rounded-lg border bg-card p-2">
          <img src={sl.image_url} alt="" className="size-12 rounded-md object-cover" /> {/* eslint-disable-line @next/next/no-img-element */}
          <Input placeholder="Caption (optional)" value={sl.caption ?? ""} onChange={(e) => onChange(slides.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
          <div className="flex flex-col">
            <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></Button>
            <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ChevronDown /></Button>
          </div>
          <Button size="icon-xs" variant="ghost" aria-label="Remove image" className="text-destructive" onClick={() => onChange(slides.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}

function SlideshowPanel(p: P) {
  const { section, update, setContent } = useSection(p, "slideshow", "Slideshow");
  const slides = (Array.isArray(section?.content.slides) ? section.content.slides : []) as Slide[];
  return (
    <Section title="Slideshow" intro="A swipeable image gallery on your card.">
      {section && <Toggle label="Show on card" on={section.is_visible} onChange={(v) => update((s) => ({ ...s, is_visible: v }))} />}
      <SlideEditor slides={slides} onChange={(n) => setContent({ slides: n })} />
    </Section>
  );
}

function StepsPanel(p: P) {
  const { section, update, setContent } = useSection(p, "steps", "Steps / how it works");
  const steps = (Array.isArray(section?.content.steps) ? section.content.steps : []) as StepItem[];
  const setSteps = (n: StepItem[]) => setContent({ steps: n });
  return (
    <Section title="Steps / how it works" intro="An ordered list: your process, how to work with you, or next steps.">
      <div className="mb-3 flex items-center justify-between gap-2">
        {section ? <Toggle label="Show on card" on={section.is_visible} onChange={(v) => update((s) => ({ ...s, is_visible: v }))} /> : <span />}
        <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { id: uid(), title: "New step", description: "" }])}><Plus /> Add step</Button>
      </div>
      {steps.map((st, i) => (
        <div key={st.id} className="mb-2 space-y-1.5 rounded-lg border bg-card p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold">{i + 1}</span>
            <Input placeholder="Step title" value={st.title} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <Button size="icon-xs" variant="ghost" aria-label="Remove step" className="text-destructive" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
          <Textarea rows={2} placeholder="Description (optional)" value={st.description ?? ""} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
        </div>
      ))}
    </Section>
  );
}

function SplashPanel(p: P) {
  const { section, update, setContent } = useSection(p, "opener", "Opener / splash");
  const c = section?.content ?? {};
  const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  const mode = (str("mode") || "standard") as "standard" | "video" | "slideshow";
  const showButton = (
    <label className="mt-3 flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={c.show_button !== false} onChange={(e) => setContent({ show_button: e.target.checked })} />
      <span>Show the “{str("primary_label") || "View card"}” button<span className="block text-[11px] text-muted-foreground">When hidden, the splash moves on by itself and a tap anywhere skips it.</span></span>
    </label>
  );
  return (
    <Section title="Splash page" intro="A welcome screen people see before your card.">
      <Toggle label="Show a splash before the card" on={Boolean(section?.is_visible)} onChange={(v) => update((s) => ({ ...s, is_visible: v }))} />
      <div className="grid grid-cols-2 gap-2">
        <F label="Close after (seconds)" hint="0 = wait for a tap."><Input type="number" min={0} value={Number(c.duration_seconds ?? 0)} onChange={(e) => setContent({ duration_seconds: Number(e.target.value) })} /></F>
        <F label="Transition">
          <select className={SELECT} value={str("transition") || "fade"} onChange={(e) => setContent({ transition: e.target.value })}>
            <option value="none">None</option><option value="fade">Fade</option><option value="slide-up">Slide up</option><option value="slide-down">Slide down</option><option value="zoom">Zoom</option>
          </select>
        </F>
      </div>
      <div className="mb-3 flex gap-1 rounded-lg border bg-muted/40 p-1">
        {([["standard", "Standard", User], ["video", "Video", PlayCircle], ["slideshow", "Slideshow", GalleryHorizontal]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setContent({ mode: k })} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium", mode === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </div>
      {mode === "standard" && (
        <>
          <ImageField label="Logo or photo" value={str("logo_url") || null} onChange={(v) => setContent({ logo_url: v ?? "" })} />
          <F label="Small heading"><Input value={str("eyebrow")} onChange={(e) => setContent({ eyebrow: e.target.value })} placeholder="Digital card" /></F>
          <F label="Title"><Input value={str("title")} onChange={(e) => setContent({ title: e.target.value })} placeholder="Welcome" /></F>
          <F label="Subtitle"><Input value={str("subtitle")} onChange={(e) => setContent({ subtitle: e.target.value })} placeholder="Tap to view my digital business card." /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label="Main button"><Input value={str("primary_label")} onChange={(e) => setContent({ primary_label: e.target.value })} placeholder="View card" /></F>
            <F label="Second button"><Input value={str("secondary_label")} onChange={(e) => setContent({ secondary_label: e.target.value })} placeholder="Call me" /></F>
          </div>
        </>
      )}
      {mode === "video" && <><VideoFields content={c} setContent={setContent} />{showButton}</>}
      {mode === "slideshow" && <><SlideEditor slides={(Array.isArray(c.slides) ? c.slides : []) as Slide[]} onChange={(n) => setContent({ slides: n })} />{showButton}</>}
    </Section>
  );
}

function VideoFields({ content, setContent }: { content: Record<string, unknown>; setContent: (p: Record<string, unknown>) => void }) {
  const url = typeof content.video_url === "string" ? content.video_url : "";
  const isFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
  const ref = useRef<HTMLVideoElement>(null);
  const [showLink, setShowLink] = useState(Boolean(url) && !isFile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pick = async (f: File) => { setBusy(true); setError(undefined); const r = await upload(f, "video"); setBusy(false); if (r.url) setContent({ video_url: r.url, video_start: 0, video_end: 0 }); else setError(r.error); };
  const picker = (label: React.ReactNode, cls: string) => (
    <label className={cn(cls, busy && "pointer-events-none opacity-60")}>{label}
      <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
    </label>
  );
  return (
    <>
      {isFile ? (
        <div className="mb-3">
          <video ref={ref} src={url} controls className="w-full rounded-lg border" />
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setContent({ video_start: Math.floor(ref.current?.currentTime ?? 0) })}>Start here</Button>
            <Button size="sm" variant="outline" onClick={() => setContent({ video_end: Math.floor(ref.current?.currentTime ?? 0) })}>End here</Button>
            {picker(<>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Replace</>, "inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs hover:bg-muted")}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setContent({ video_url: "", video_start: 0, video_end: 0 })}>Remove</Button>
          </div>
        </div>
      ) : picker(
        <>{busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5 text-muted-foreground" />}<span className="text-sm font-medium">{busy ? "Uploading…" : "Upload a video"}</span><span className="text-[11px] text-muted-foreground">MP4, WEBM or MOV, up to 100 MB</span></>,
        "mb-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center hover:bg-muted/50",
      )}
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <button type="button" onClick={() => setShowLink((v) => !v)} className="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <LinkIcon className="size-3.5" /> {showLink ? "Hide video link" : "Use a YouTube or Vimeo link instead"}
      </button>
      {showLink && <F label="Video link"><Input value={url} onChange={(e) => setContent({ video_url: e.target.value })} placeholder="https://…" /></F>}
      <div className="grid grid-cols-2 gap-2">
        <F label="Start (seconds)"><Input type="number" min={0} value={Number(content.video_start ?? 0)} onChange={(e) => setContent({ video_start: Number(e.target.value) })} /></F>
        <F label="End (seconds)" hint="0 = play to the end"><Input type="number" min={0} value={Number(content.video_end ?? 0)} onChange={(e) => setContent({ video_end: Number(e.target.value) })} /></F>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={content.video_muted === false} onChange={(e) => setContent({ video_muted: !e.target.checked })} /> Play with sound</label>
      <p className="mt-1 text-[11px] text-muted-foreground">Browsers start videos muted; with sound on, visitors may need to tap for audio.</p>
    </>
  );
}

const AUTOMATIONS: { action: AutomationAction; label: string; desc: string; message?: boolean }[] = [
  { action: "notify_owner_email", label: "Email me on a new lead", desc: "Emails the card's email address when someone sends their info." },
  { action: "notify_owner_sms", label: "Text me on a new lead", desc: "Texts the card's phone number when a new lead comes in." },
  { action: "autoreply_email", label: "Auto-reply to the lead", desc: "Sends a thank-you email to the person (when they leave an email).", message: true },
];

function AutomationsPanel({ draft, setDesign }: P) {
  const list = draft.design.automations;
  const rule = (a: AutomationAction) => list.find((x) => x.action === a);
  const setRule = (a: AutomationAction, p: { enabled?: boolean; message?: string }) => setDesign((d) => ({
    ...d, automations: d.automations.some((x) => x.action === a) ? d.automations.map((x) => (x.action === a ? { ...x, ...p } : x)) : [...d.automations, { action: a, enabled: false, ...p }],
  }));
  return (
    <Section title="Automations" intro="Run these when someone sends their info from your card. You always get an in-app notification.">
      {AUTOMATIONS.map((a) => {
        const r = rule(a.action);
        return (
          <div key={a.action} className="mb-2 rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1"><p className="text-sm font-medium">{a.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p></div>
              <Switch checked={Boolean(r?.enabled)} onCheckedChange={(v) => setRule(a.action, { enabled: v })} aria-label={a.label} />
            </div>
            {a.message && r?.enabled && <Textarea className="mt-2" rows={3} placeholder="Thanks for reaching out! I'll be in touch shortly." value={r.message ?? ""} onChange={(e) => setRule(a.action, { message: e.target.value })} />}
          </div>
        );
      })}
    </Section>
  );
}
