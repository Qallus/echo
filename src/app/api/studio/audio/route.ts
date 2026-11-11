import { getUser } from "@/lib/data";
import { audioMime, saveStudioFile } from "@/lib/studio/save";
import { MAX_FILE_BYTES, isKind } from "@/lib/studio/types";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// POST /api/studio/audio (multipart: file, name?, description?, kind?,
// source, image?, duration?): saves an upload, a microphone recording or a
// rendered mix to the person's studio.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to use the studio." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "Choose an audio file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "Files can be up to 50 MB." }, { status: 413 });
  const mime = audioMime(file.type, file.name);
  if (!mime) return Response.json({ error: "That isn't an audio file we can use (WAV, MP3, M4A, AAC, OGG, WebM or FLAC)." }, { status: 415 });
  const source = String(form.get("source") ?? "upload");
  const kind = form.get("kind");
  const saved = await saveStudioFile(await createClient(), user.id, {
    bytes: await file.arrayBuffer(), mime,
    name: String(form.get("name") ?? "").trim() || file.name.replace(/\.[^.]+$/, ""),
    source: source === "record" || source === "mix" ? source : "upload",
    kind: isKind(kind) ? kind : "other",
    description: (form.get("description") as string | null) ?? null,
    image: (form.get("image") as string | null) || null,
    duration: Number(form.get("duration")) || null,
  });
  if ("error" in saved) return Response.json(saved, { status: 500 });
  return Response.json({ audio: saved });
}
