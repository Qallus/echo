"use client";

import { useRef, useState } from "react";
import { Building2, ImagePlus, Link2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// A contact's photo or a client's logo: upload a picture (shrunk in the
// browser to a small image, a few KB, stored with the record) or switch to a
// link (https://...). Submitted as a hidden form field; empty removes it.

const MAX = 40000;

// Photos are cropped square (faces); logos keep their shape on a transparent square.
async function shrink(file: File, kind: "photo" | "logo"): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = kind === "photo" ? 128 : 160;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    if (kind === "photo") {
      const s = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    } else {
      const scale = Math.min(size / bmp.width, size / bmp.height);
      const w = bmp.width * scale, h = bmp.height * scale;
      ctx.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
    }
    bmp.close();
    for (const q of [0.85, 0.7, 0.55]) {
      const url = kind === "photo" ? canvas.toDataURL("image/jpeg", q) : canvas.toDataURL("image/webp", q);
      if (url.length <= MAX && /^data:image\/(jpeg|png|webp);base64,/.test(url)) return url;
    }
    return null;
  } catch {
    return null;
  }
}

export function ImageField({ name, label, kind, defaultValue, className }: { name: string; label: string; kind: "photo" | "logo"; defaultValue?: string | null; className?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [byLink, setByLink] = useState(Boolean(defaultValue?.startsWith("https://")));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const Fallback = kind === "photo" ? UserRound : Building2;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(undefined);
    if (!f.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setBusy(true);
    const url = await shrink(f, kind);
    setBusy(false);
    if (url) setValue(url); else setError("That image couldn't be used. Try a JPG or PNG.");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <span className={cn("grid size-16 shrink-0 place-items-center overflow-hidden border bg-muted", kind === "photo" ? "rounded-full" : "rounded-lg")}>
          {value
            // eslint-disable-next-line @next/next/no-img-element -- data URLs and outside links
            ? <img src={value} alt="" className={cn("size-full", kind === "photo" ? "object-cover" : "object-contain p-1")} referrerPolicy="no-referrer" />
            : <Fallback className="size-6 text-muted-foreground" />}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {byLink ? (
            <Input type="url" inputMode="url" placeholder="https://…" value={value.startsWith("data:") ? "" : value} maxLength={500}
              onChange={(e) => { setError(undefined); setValue(e.target.value.trim()); }} aria-label={`${label} link`} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => file.current?.click()}><ImagePlus /> {busy ? "Preparing…" : value ? "Replace" : "Upload"}</Button>
              {value && <Button type="button" size="sm" variant="ghost" onClick={() => setValue("")}><Trash2 /> Remove</Button>}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch size="sm" checked={byLink} onCheckedChange={(on) => { setByLink(on); setError(undefined); }} />
            <Link2 className="size-3.5" /> Use a link instead
          </label>
        </div>
      </div>
      {byLink && value && !/^https:\/\//.test(value) && !value.startsWith("data:") && <p className="text-xs text-destructive">Links must start with https://</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
