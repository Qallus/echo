"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeAvatar, setAvatar } from "@/app/(app)/settings/actions";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "./user-avatar";

const SIZE = 512;

// Centre-crops to a square and re-encodes as 512px webp, so uploads are small
// and every avatar is the same shape.
async function toSquareWebp(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  img.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), "image/webp", 0.9));
}

export function AvatarUpload({ userId, name, email, src }: { userId: string; name: string | null; email: string; src: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(src);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const upload = (file: File) => start(async () => {
    setError(undefined);
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    try {
      const blob = await toSquareWebp(file);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
      if (upErr) return setError(upErr.message);
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const res = await setAvatar(url);
      if (res.error) return setError(res.error);
      setPreview(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  });

  const remove = () => start(async () => {
    const res = await removeAvatar();
    if (res.error) setError(res.error);
    else setPreview(null);
  });

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="group relative rounded-full" aria-label="Change photo">
        <UserAvatar name={name} email={email} src={preview} size="xl" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <Camera /> {preview ? "Change photo" : "Upload photo"}
          </Button>
          {preview && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}><Trash2 /> Remove</Button>}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Cropped to a square.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
