import "server-only";
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
