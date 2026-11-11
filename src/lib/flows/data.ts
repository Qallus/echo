import "server-only";
import { getUser } from "@/lib/data";
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

export type FlowVersion = { version: number; note: string | null; publishedAt: string; current: boolean };
export type FlowDraft = {
  id: string; name: string; description: string | null; draft: unknown; rev: number; updatedAt: string; publishedVersion: number | null;
  published: unknown; versions: FlowVersion[]; lineIds: string[]; mine: boolean;
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
  const [{ data: f }, user] = await Promise.all([
    supabase.from("call_flows")
      .select("id, name, description, owner_id, draft, draft_rev, draft_updated_at, published_version_id, published:call_flow_versions!call_flows_published_version_fk(version, definition)")
      .eq("id", id).maybeSingle(),
    getUser(),
  ]);
  if (!f) return null;
  const [{ data: versions }, { data: lines }] = await Promise.all([
    supabase.from("call_flow_versions").select("id, version, note, published_at").eq("flow_id", id).order("version", { ascending: false }).limit(50),
    supabase.from("call_flow_lines").select("line_id").eq("flow_id", id),
  ]);
  const published = f.published as unknown as { version: number; definition: unknown } | null;
  return {
    id: f.id, name: f.name, description: f.description, draft: f.draft, rev: f.draft_rev, updatedAt: f.draft_updated_at,
    publishedVersion: published?.version ?? null, published: published?.definition ?? null, mine: f.owner_id === user?.id,
    versions: (versions ?? []).map((v) => ({ version: v.version, note: v.note, publishedAt: v.published_at, current: v.id === f.published_version_id })),
    lineIds: (lines ?? []).map((l) => l.line_id),
  };
}

// What the block forms can pick from: Recording Studio clips, the lines the
// person can build on, their Directory contacts and extensions, and other
// flows (for "Run another flow").
export type BuilderLine = { id: string; label: string; number: string; canManage: boolean; flowId: string | null; flowName: string | null };
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
  const [{ data: dir }, { data: ext }, { data: onLines }] = lineIds.length
    ? await Promise.all([
      supabase.from("redial_directory").select("id, line_id, label, number").in("line_id", lineIds).order("sort").order("label"),
      supabase.from("redial_extensions").select("id, line_id, ext, name, directory_id, number, ring_seconds, voicemail_audio_id").in("line_id", lineIds).order("ext"),
      supabase.from("call_flow_lines").select("line_id, flow:call_flows(id, name)").in("line_id", lineIds),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const running = new Map((onLines ?? []).map((r) => [r.line_id, r.flow as unknown as { id: string; name: string } | null]));
  return {
    recordings: audio.filter((a) => !a.archived_at).map((a) => ({ id: a.id, name: a.name, kind: a.kind, url: a.url, duration: a.duration_seconds })),
    lines: lines.map((l) => ({ id: l.id, label: l.label, number: l.number, canManage: allows(l.access, "manage_flows"), flowId: running.get(l.id)?.id ?? null, flowName: running.get(l.id)?.name ?? null })),
    directory: (dir ?? []).map((d) => ({ id: d.id, lineId: d.line_id, label: d.label, number: d.number })),
    extensions: (ext ?? []).map((e) => ({
      id: e.id, lineId: e.line_id, ext: e.ext, name: e.name, directoryId: e.directory_id, number: e.number, ringSeconds: e.ring_seconds, voicemailAudioId: e.voicemail_audio_id,
    })),
    flows: (flows.data ?? []).map((f) => ({ id: f.id, name: f.name })),
  };
}

// Recent calls through a call tree, each with the blocks it passed through.
export type FlowRun = {
  id: string; from: string | null; status: string; startedAt: string; endedAt: string | null; version: number | null;
  steps: { seq: number; node: string; type: string; transition: string | null; data: Record<string, unknown>; at: string }[];
};

export async function flowRuns(flowId: string): Promise<FlowRun[]> {
  const supabase = await createClient();
  const { data: runs } = await supabase.from("call_flow_runs")
    .select("id, from_number, status, started_at, ended_at, version:call_flow_versions(version)")
    .eq("flow_id", flowId).order("started_at", { ascending: false }).limit(50);
  if (!runs?.length) return [];
  const { data: steps } = await supabase.from("call_flow_run_steps").select("run_id, seq, node_id, node_type, transition, data, started_at")
    .in("run_id", runs.map((r) => r.id)).order("seq");
  return runs.map((r) => ({
    id: r.id, from: r.from_number, status: r.status, startedAt: r.started_at, endedAt: r.ended_at,
    version: (r.version as unknown as { version: number } | null)?.version ?? null,
    steps: (steps ?? []).filter((s) => s.run_id === r.id).map((s) => ({ seq: s.seq, node: s.node_id, type: s.node_type, transition: s.transition, data: (s.data ?? {}) as Record<string, unknown>, at: s.started_at })),
  }));
}
