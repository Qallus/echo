"use client";

import { useRef, useState } from "react";
import { Ban, Check, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LOGOS, type EmailBlock } from "@/lib/comms/blocks";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const BUCKET = "email-assets";
const isUpload = (u?: string) => !!u && u.includes(`/storage/v1/object/public/${BUCKET}/`);
const isPreset = (u?: string) => LOGOS.some((l) => l.url === u);
const isLink = (u?: string) => !!u && !isUpload(u) && !isPreset(u);

async function uploadImage(file: File, folder: string): Promise<{ url?: string; error?: string }> {
  if (!TYPES.includes(file.type)) return { error: "Use a PNG, JPG, GIF or WebP image. Email apps don't show SVG." };
  if (file.size > 2 * 1024 * 1024) return { error: "Images can be up to 2 MB." };
  const supabase = createClient();
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return error ? { error: error.message } : { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// Any block's picture: upload one (the main way) or, with the toggle on,
// paste an https link. Used by Image, Card, Video, Quote, Signature and the
// header logo.
export function ImageField({ label, value, onChange, folder = "images", hint }: {
  label: string; value?: string; onChange: (url: string, name?: string) => void; folder?: string; hint?: string;
}) {
  const [useUrl, setUseUrl] = useState(() => isLink(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true); setError("");
    const res = await uploadImage(f, folder);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (res.error) setError(res.error);
    else { onChange(res.url!, f.name.replace(/\.[^.]+$/, "")); setUseUrl(false); }
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        {isUpload(value) && (
          <span className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-[repeating-conic-gradient(#e4e4e7_0_25%,#fff_0_50%)] bg-[length:10px_10px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the uploaded image */}
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <Button type="button" size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Uploading…" : isUpload(value) ? "Replace" : "Upload image"}
        </Button>
        {isUpload(value) && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange("")}><X /></Button>}
      </div>
      <input ref={file} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>Use an image URL</span>
        <Switch checked={useUrl} onCheckedChange={(on) => { setUseUrl(on); if (!on && isLink(value)) onChange(""); }} />
      </label>
      {useUrl && <Input value={isLink(value) ? value : ""} onChange={(e) => onChange(e.target.value.trim())} className="h-8" placeholder="https://…/image.png" aria-label={`${label} URL`} autoFocus />}
      <p className="text-[11px] text-muted-foreground">{hint ?? "PNG, JPG, GIF or WebP, up to 2 MB."}</p>
    </div>
  );
}

// The header's logo: Echo or Redial (dark or light), no logo, or your own
// (upload, or a link with the toggle on).
export function LogoField({ b, set }: { b: EmailBlock; set: (patch: Partial<EmailBlock>) => void }) {
  const tile = (active: boolean) => cn("relative flex h-14 items-center justify-center rounded-lg border-2 p-2 transition-colors", active ? "border-primary" : "border-transparent ring-1 ring-border hover:ring-primary/50");
  const mark = (active: boolean) => active && <Check className="absolute top-1 right-1 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Logo</Label>
        <div className="grid grid-cols-2 gap-2">
          {LOGOS.map((l) => (
            <button key={l.url} type="button" aria-pressed={b.url === l.url} aria-label={`${l.label} logo, ${l.tone}`} title={`${l.label} ${l.tone}: for ${l.tone === "dark" ? "light" : "dark"} headers`}
              onClick={() => set({ url: l.url, alt: l.alt, title: "", backgroundColor: l.tone === "dark" ? "#ffffff" : "#18181b" })}
              className={cn(tile(b.url === l.url), l.tone === "dark" ? "bg-white" : "bg-zinc-900")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- small static logo previews */}
              <img src={l.url} alt="" className="max-h-6 w-auto" />
              {mark(b.url === l.url)}
            </button>
          ))}
          <button type="button" aria-pressed={!b.url} onClick={() => set({ url: "", title: b.title || "ECHO" })}
            className={cn(tile(!b.url), "col-span-2 h-9 gap-1.5 bg-muted/40 text-xs text-muted-foreground")}>
            <Ban className="size-3.5" /> No logo, brand text only {mark(!b.url)}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Dark logos suit light headers and light logos suit dark ones; picking one sets the header color to match.</p>
      </div>
      <ImageField label="Your own logo" folder="logos" value={isPreset(b.url) ? "" : b.url}
        onChange={(url, name) => set({ url, title: url ? "" : b.title, ...(name ? { alt: name } : {}) })} />
    </div>
  );
}
