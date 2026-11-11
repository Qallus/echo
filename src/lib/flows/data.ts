import "server-only";
import { myLines } from "@/lib/redial/data";
import { allows } from "@/lib/redial/types";
import { myStudioAudio } from "@/lib/studio/data";
import { createClient } from "@/lib/supabase/server";

// Call Tree reads, as the signed-in person. RLS: flows they own, or flows on
// a line where they have manage_flows.

export type FlowSummary = {
  id: string; name: string; description: string | null; mine: boolean; updatedAt: string;
  publishedVersion: number | null; lines: { id: string; label: string; number: string }[];
};

export type FlowDraft = {
  id: string; name: string; description: string | null; draft: unknown; rev: number; updatedAt: string; publishedVersion: number | null;
};

type LineRow = { line_id: string; line: { label: string; number: string } | null };

export async function myFlows(userId: string): Promise<FlowSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("call_flows")
    .select("id, name, description, owner_id, draft_updated_at, published:call_flow_versions!call_flows_published_version_fk(version), lines:call_flow_lines(line_id, line:redial_lines(label, number))")
    .order("draft_updated_at", { ascending: false }).limit(200);
  return (data ?? []).map((f) => ({
    id: f.id, name: f.name, description: f.description, mine: f.owner_id === userId, updatedAt: f.draft_updated_at,
    publishedVersion: (f.published as unknown as { version: number } | null)?.version ?? null,
    lines: ((f.lines ?? []) as unknown as LineRow[]).map((l) => ({ id: l.line_id, label: l.line?.label ?? "Line", number: l.line?.number ?? "" })),
  }));
}

export async function flowForEditing(id: string): Promise<FlowDraft | null> {
  const supabase = await createClient();
  const { data: f } = await supabase.from("call_flows")
    .select("id, name, description, draft, draft_rev, draft_updated_at, published:call_flow_versions!call_flows_published_version_fk(version)")
    .eq("id", id).maybeSingle();
  if (!f) return null;
  return {
    id: f.id, name: f.name, description: f.description, draft: f.draft, rev: f.draft_rev, updatedAt: f.draft_updated_at,
    publishedVersion: (f.published as unknown as { version: number } | null)?.version ?? null,
  };
}

// What the block forms can pick from: Recording Studio clips, the lines the
// person can build on, their Directory contacts and extensions, and other
// flows (for "Run another flow").
export type BuilderLine = { id: string; label: string; number: string; canManage: boolean };
export type BuilderExtension = {
  id: string; lineId: string; ext: string; name: string; directoryId: string | null; number: string | null;
  ringSeconds: number; voicemailAudioId: string | null;
};
export type BuilderContext = {
  recordings: { id: string; name: string; kind: string; url: string | null; duration: number | null }[];
  lines: BuilderLine[];
  directory: { id: string; lineId: string; label: string; number: string }[];
  extensions: BuilderExtension[];
  flows: { id: string; name: string }[];
};

export async function builderContext(flowId: string): Promise<BuilderContext> {
  const supabase = await createClient();
  const [audio, lines, flows] = await Promise.all([myStudioAudio(), myLines(), supabase.from("call_flows").select("id, name").neq("id", flowId).order("name")]);
  const lineIds = lines.map((l) => l.id);
  const [{ data: dir }, { data: ext }] = lineIds.length
    ? await Promise.all([
      supabase.from("redial_directory").select("id, line_id, label, number").in("line_id", lineIds).order("sort").order("label"),
      supabase.from("redial_extensions").select("id, line_id, ext, name, directory_id, number, ring_seconds, voicemail_audio_id").in("line_id", lineIds).order("ext"),
    ])
    : [{ data: [] }, { data: [] }];
  return {
    recordings: audio.filter((a) => !a.archived_at).map((a) => ({ id: a.id, name: a.name, kind: a.kind, url: a.url, duration: a.duration_seconds })),
    lines: lines.map((l) => ({ id: l.id, label: l.label, number: l.number, canManage: allows(l.access, "manage_flows") })),
    directory: (dir ?? []).map((d) => ({ id: d.id, lineId: d.line_id, label: d.label, number: d.number })),
    extensions: (ext ?? []).map((e) => ({
      id: e.id, lineId: e.line_id, ext: e.ext, name: e.name, directoryId: e.directory_id, number: e.number, ringSeconds: e.ring_seconds, voicemailAudioId: e.voicemail_audio_id,
    })),
    flows: (flows.data ?? []).map((f) => ({ id: f.id, name: f.name })),
  };
}
