"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace, requireUser } from "@/lib/data";
import { SAMPLE, SAMPLE_FOLDERS } from "@/lib/sample-data";

// Server actions. Each uses the signed-in user's client, so RLS still applies.

export async function toggleActionItem(id: string, done: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createFolder(name: string) {
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("folders").insert({ workspace_id: ws.id, name: clean });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Copies the sample recordings (with transcripts and summaries) into the workspace.
export async function loadSampleData() {
  const user = await requireUser();
  const ws = await getWorkspace();
  const supabase = await createClient();

  const { data: folders, error: fErr } = await supabase
    .from("folders")
    .insert(SAMPLE_FOLDERS.map((name) => ({ workspace_id: ws.id, name })))
    .select("id, name");
  if (fErr) throw new Error(fErr.message);
  const folderId = (name: string | null) => folders.find((f) => f.name === name)?.id ?? null;

  for (const s of SAMPLE) {
    const r = s.recording;
    const { data: rec, error } = await supabase
      .from("recordings")
      .insert({
        workspace_id: ws.id, created_by: user.id, folder_id: folderId(r.folderId), title: r.title,
        source: r.source, status: r.status, duration_sec: r.durationSec, created_at: r.createdAt, deleted_at: r.deletedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const writes = [];
    if (s.segments.length) {
      writes.push(supabase.from("transcript_segments").insert(
        s.segments.map((g, i) => ({ recording_id: rec.id, position: i, speaker: g.speaker, start_sec: g.startSec, text: g.text })),
      ));
    }
    if (s.highlights.length) {
      writes.push(supabase.from("highlights").insert(
        s.highlights.map((h) => ({ recording_id: rec.id, start_sec: h.startSec, text: h.text })),
      ));
    }
    if (s.summary) {
      const sum = s.summary;
      writes.push(supabase.from("summaries").insert({
        recording_id: rec.id, template: sum.template, model: sum.model, overview: sum.overview,
        key_points: sum.keyPoints, mind_map: sum.mindMap,
      }));
      writes.push(supabase.from("action_items").insert(
        sum.actionGroups.flatMap((g) => g.items.map((it) => ({ owner_name: g.owner, owner_role: g.role, text: it.text, done: it.done })))
          .map((it, i) => ({ ...it, recording_id: rec.id, position: i })),
      ));
    }
    const results = await Promise.all(writes);
    const failed = results.find((x) => x.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
  revalidatePath("/", "layout");
}
