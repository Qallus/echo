"use client";

import { useRef, useState } from "react";
import { Ban, Check, Loader2, Upload } from "lucide-react";
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

async function uploadLogo(file: File): Promise<{ url?: string; error?: string }> {
  if (!TYPES.includes(file.type)) return { error: "Use a PNG, JPG, GIF or WebP image. Email apps don't show SVG." };
  if (file.size > 2 * 1024 * 1024) return { error: "Logos can be up to 2 MB." };
  const supabase = createClient();
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `logos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return error ? { error: error.message } : { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// The header's logo: Echo or Redial (dark or light), your own upload, or,
// with the toggle on, any https image link.
export function LogoField({ b, set }: { b: EmailBlock; set: (patch: Partial<EmailBlock>) => void }) {
  const [useUrl, setUseUrl] = useState(() => !!b.url && !isPreset(b.url) && !isUpload(b.url));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const tile = (active: boolean) => cn("relative flex h-14 items-center justify-center rounded-lg border-2 p-2 transition-colors", active ? "border-primary" : "border-transparent ring-1 ring-border hover:ring-primary/50");
  const mark = (active: boolean) => active && <Check className="absolute top-1 right-1 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />;

  const pick = (url: string, alt: string, tone: "dark" | "light") => set({ url, alt, title: "", backgroundColor: tone === "dark" ? "#ffffff" : "#18181b" });
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true); setError("");
    const res = await uploadLogo(f);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (res.error) setError(res.error);
    else set({ url: res.url, alt: b.alt || f.name.replace(/\.[^.]+$/, ""), title: "" });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Logo</Label>
      <div className="grid grid-cols-2 gap-2">
        {LOGOS.map((l) => (
          <button key={l.url} type="button" onClick={() => pick(l.url, l.alt, l.tone)} aria-pressed={b.url === l.url}
            aria-label={`${l.label} logo, ${l.tone}`} title={`${l.label} ${l.tone}: for ${l.tone === "dark" ? "light" : "dark"} headers`}
            className={cn(tile(b.url === l.url), l.tone === "dark" ? "bg-white" : "bg-zinc-900")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- small static logo previews */}
            <img src={l.url} alt="" className="max-h-6 w-auto" />
            {mark(b.url === l.url)}
          </button>
        ))}
        <button type="button" onClick={() => file.current?.click()} disabled={busy} aria-pressed={isUpload(b.url)}
          className={cn(tile(isUpload(b.url)), "flex-col gap-0.5 bg-muted/40 text-xs text-muted-foreground")}>
          {isUpload(b.url)
            // eslint-disable-next-line @next/next/no-img-element -- the uploaded logo
            ? <img src={b.url} alt="" className="max-h-6 w-auto" />
            : busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <span>{busy ? "Uploading…" : isUpload(b.url) ? "Replace" : "Upload logo"}</span>
          {mark(isUpload(b.url))}
        </button>
        <button type="button" onClick={() => { set({ url: "", title: b.title || "ECHO" }); setUseUrl(false); }} aria-pressed={!b.url}
          className={cn(tile(!b.url), "flex-col gap-0.5 bg-muted/40 text-xs text-muted-foreground")}>
          <Ban className="size-4" /><span>No logo</span>{mark(!b.url)}
        </button>
      </div>
      <input ref={file} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <p className="text-[11px] text-muted-foreground">Dark logos suit light headers and light logos suit dark ones; picking one sets the header color to match. Uploads: PNG, JPG, GIF or WebP, up to 2 MB.</p>

      <label className="flex items-center justify-between gap-2 pt-1 text-sm">
        <span>Use a logo URL</span>
        <Switch checked={useUrl} onCheckedChange={(on) => { setUseUrl(on); if (!on && b.url && !isPreset(b.url) && !isUpload(b.url)) set({ url: "" }); }} />
      </label>
      {useUrl && (
        <Input value={isPreset(b.url) || isUpload(b.url) ? "" : b.url ?? ""} onChange={(e) => set({ url: e.target.value.trim(), title: "" })}
          className="h-8" placeholder="https://…/logo.png" aria-label="Logo URL" autoFocus />
      )}
    </div>
  );
}
