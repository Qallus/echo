import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { namesOnLine } from "./live-blocks";
import { canPublish, validateFlow } from "./schema";
import { voiceFlow } from "./voice-clips";

// Publish a call tree's draft as the next version and choose which lines
// answer with it (a line runs one call tree, so choosing a line takes it from
// any other tree). Shared by the Call Tree page and the Claude connector; runs
// as the signed-in person (RLS decides who can publish).
export async function publishCallTree(supabase: SupabaseClient, userId: string, id: string, note: string, lineIds: string[]): Promise<{ version?: number; error?: string; voiced?: number }> {
  const { data: f } = await supabase.from("call_flows").select("draft, owner_id").eq("id", id).maybeSingle();
  if (!f) return { error: "This call tree was deleted, or you no longer have access." };
  const { flow, issues } = validateFlow(f.draft);
  if (!canPublish(issues) || !flow) return { error: "Fix the problems marked in red first." };
  // Prompts and phrases in the call tree's AI voice become Studio clips (the owner's).
  let voiced = 0;
  if (flow.settings.voice) {
    if (f.owner_id !== userId) return { error: "Only the call tree's owner can publish it with an AI voice (the clips go in their Recording Studio)." };
    const { data: lines } = lineIds.length ? await supabase.from("redial_lines").select("id, owner_id").in("id", lineIds) : { data: [] };
    const names = [...new Set((await Promise.all((lines ?? []).map((l) => namesOnLine(supabase, l)))).flat().map((x) => x.name))].slice(0, 50);
    const v = await voiceFlow(supabase, userId, flow, flow.name, names);
    if (v.errors.length) return { error: `Couldn't make the voice clips: ${v.errors.slice(0, 2).join("; ")}` };
    voiced = v.made;
    if (voiced || JSON.stringify(v.flow.settings.voiced ?? {}) !== JSON.stringify(flow.settings.voiced ?? {})) {
      const { error } = await supabase.from("call_flows").update({ draft: v.flow }).eq("id", id);
      if (error) return { error: "Couldn't save the voice clips to the call tree." };
    }
  }
  const { data: version, error } = await supabase.rpc("call_flow_publish", { p_flow: id, p_note: note.trim().slice(0, 300) || null });
  if (error) return { error: "Couldn't publish the call tree." };
  const lines = await setFlowLines(supabase, id, lineIds);
  return lines.error ? { version: version as number, error: lines.error, voiced } : { version: version as number, voiced };
}

async function setFlowLines(supabase: SupabaseClient, id: string, lineIds: string[]): Promise<{ error?: string }> {
  const wanted = [...new Set(lineIds.filter((l) => /^[0-9a-f-]{36}$/i.test(l)))].slice(0, 50);
  const { data: current } = await supabase.from("call_flow_lines").select("line_id").eq("flow_id", id);
  const drop = (current ?? []).map((r) => r.line_id).filter((l) => !wanted.includes(l));
  if (drop.length) await supabase.from("call_flow_lines").delete().eq("flow_id", id).in("line_id", drop);
  for (const lineId of wanted) {
    if ((current ?? []).some((r) => r.line_id === lineId)) continue;
    await supabase.from("call_flow_lines").delete().eq("line_id", lineId);
    const { error } = await supabase.from("call_flow_lines").insert({ line_id: lineId, flow_id: id });
    if (error) return { error: "Published, but some lines couldn't be switched to this call tree." };
  }
  return {};
}
