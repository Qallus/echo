"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/live-agents/agent-avatar";
import { markAgentStep, setAgentPhoto } from "@/lib/live-agents/agent-actions";
import { createClient } from "@/lib/supabase/client";
import { StepFooter } from "./step-footer";

const SIZE = 640;

// Centre-crops to a square, 640px webp, so photos are small and the same shape.
async function toSquareWebp(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  img.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image."))), "image/webp", 0.88));
}

// Step 2: a friendly, face-centred photo.
export function PhotoStep({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const upload = (file: File) => start(async () => {
    setError(undefined);
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG or WebP image.");
    if (file.size > 15 * 1024 * 1024) return setError("That image is over 15 MB.");
    try {
      const blob = await toSquareWebp(file);
      const supabase = createClient();
      const path = `${userId}/photo-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from("live-agent-media").upload(path, blob, { contentType: "image/webp" });
      if (upErr) return setError("Upload failed. Try again.");
      const r = await setAgentPhoto(path);
      if (r.error) return setError(r.error);
      setPreview(supabase.storage.from("live-agent-media").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  });

  const remove = () => start(async () => {
    const r = await setAgentPhoto(null);
    if (r.error) setError(r.error); else setPreview(null);
  });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Businesses book people they feel they can trust. A clear, friendly photo of your face gets far more messages.</p>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <button type="button" onClick={() => input.current?.click()} className="group relative rounded-2xl" aria-label={preview ? "Change photo" : "Upload photo"}>
          <AgentAvatar name={name} url={preview} online={false} size="lg" />
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </span>
        </button>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}><Camera /> {preview ? "Change photo" : "Upload photo"}</Button>
            {preview && <Button type="button" variant="ghost" disabled={pending} onClick={remove}><Trash2 /> Remove</Button>}
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP. We crop it to a square.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {["Just you, face centred, looking at the camera", "Good light, plain background", "No logos, text, phone numbers or other people", "Reviewed by the Redial team before it's public"].map((t) => (
          <li key={t} className="rounded-xl border p-3">{t}</li>
        ))}
      </ul>
      <StepFooter step={2} save={() => markAgentStep(2)} label={preview ? "Continue" : "Skip for now"} />
    </div>
  );
}
