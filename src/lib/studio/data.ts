import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { StudioAudio } from "./types";

// Recording Studio reads, as the signed-in person (RLS: their own rows and
// files only). Files get short-lived signed URLs for playback.

export const BUCKET = "studio-audio";
const COLUMNS = "id, name, description, kind, status, source, ai_provider, ai_voice, extension, storage_path, mime, size_bytes, duration_seconds, image, archived_at, created_at";
const URL_TTL = 60 * 60 * 6;
// Before the studio_audio_details migration there's no extension column.
const OLD_COLUMNS = COLUMNS.replace(" extension,", "");

type Row = Omit<StudioAudio, "url" | "used_in"> & { storage_path: string };

export async function withUrls(supabase: SupabaseClient, rows: Row[]): Promise<StudioAudio[]> {
  if (!rows.length) return [];
  const [{ data }, usedIn] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), URL_TTL),
    whereUsed(supabase, rows.map((r) => r.id)),
  ]);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map(({ storage_path, ...r }) => ({
    ...r, extension: r.extension ?? null, duration_seconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    used_in: usedIn.get(r.id) ?? [], url: urls.get(storage_path) ?? null,
  }));
}

// Which call trees (draft or published) and extension voicemails play each clip.
async function whereUsed(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const add = (id: string, label: string) => { const l = out.get(id) ?? []; if (!l.includes(label)) out.set(id, [...l, label]); };
  const [{ data: flows }, { data: exts }] = await Promise.all([
    supabase.from("call_flows").select("name, draft").limit(200),
    supabase.from("redial_extensions").select("ext, name, voicemail_audio_id").in("voicemail_audio_id", ids),
  ]);
  for (const f of flows ?? []) {
    const json = JSON.stringify(f.draft ?? {});
    for (const id of ids) if (json.includes(id)) add(id, f.name);
  }
  for (const e of exts ?? []) if (e.voicemail_audio_id) add(e.voicemail_audio_id, `Ext ${e.ext} voicemail (${e.name})`);
  return out;
}

export async function myStudioAudio(): Promise<StudioAudio[]> {
  const supabase = await createClient();
  const q = (cols: string) => supabase.from("studio_audio").select(cols).order("created_at", { ascending: false }).limit(500);
  const first = await q(COLUMNS);
  const data = first.error ? (await q(OLD_COLUMNS)).data : first.data;
  return withUrls(supabase, (data ?? []) as unknown as Row[]);
}

export async function studioAudioById(supabase: SupabaseClient, id: string): Promise<StudioAudio | null> {
  const first = await supabase.from("studio_audio").select(COLUMNS).eq("id", id).maybeSingle();
  const data = first.error ? (await supabase.from("studio_audio").select(OLD_COLUMNS).eq("id", id).maybeSingle()).data : first.data;
  return data ? (await withUrls(supabase, [data as unknown as Row]))[0] : null;
}
