import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { StudioAudio } from "./types";

// Recording Studio reads, as the signed-in person (RLS: their own rows and
// files only). Files get short-lived signed URLs for playback.

export const BUCKET = "studio-audio";
const COLUMNS = "id, name, description, kind, status, source, ai_provider, ai_voice, storage_path, mime, size_bytes, duration_seconds, image, archived_at, created_at";
const URL_TTL = 60 * 60 * 6;

type Row = Omit<StudioAudio, "url"> & { storage_path: string };

export async function withUrls(supabase: SupabaseClient, rows: Row[]): Promise<StudioAudio[]> {
  if (!rows.length) return [];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), URL_TTL);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map(({ storage_path, ...r }) => ({ ...r, duration_seconds: r.duration_seconds == null ? null : Number(r.duration_seconds), url: urls.get(storage_path) ?? null }));
}

export async function myStudioAudio(): Promise<StudioAudio[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("studio_audio").select(COLUMNS).order("created_at", { ascending: false }).limit(500);
  return withUrls(supabase, (data ?? []) as Row[]);
}

export async function studioAudioById(supabase: SupabaseClient, id: string): Promise<StudioAudio | null> {
  const { data } = await supabase.from("studio_audio").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? (await withUrls(supabase, [data as Row]))[0] : null;
}
