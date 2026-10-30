import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { check, confirmArg, found, id, recordingWorkspace } from "./shared";

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const segment = z.object({
  speaker: z.string().trim().min(1).max(80).default("Speaker"),
  start_sec: z.number().int().min(0).default(0),
  text: z.string().trim().min(1).max(10_000),
});


export function registerTranscriptTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "transcript_replace", {
    title: "Replace transcript",
    description: "Replace a recording's whole transcript with these segments (paste or fix a transcript).",
    inputSchema: z.object({ recording_id: id("Recording"), segments: z.array(segment).min(1).max(5000) }),
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, async ({ recording_id, segments }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    // Insert the new segments after the old ones, then remove the old ones,
    // so a failed insert never leaves the recording without a transcript.
    const { data: last, error } = await ctx.supabase
      .from("transcript_segments").select("position").eq("recording_id", recording_id)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    check(error);
    const base = (last?.position ?? -1) + 1;
    for (let i = 0; i < segments.length; i += 500) {
      const chunk = segments.slice(i, i + 500).map((s, j) => ({ ...s, recording_id, position: base + i + j }));
      check((await ctx.supabase.from("transcript_segments").insert(chunk)).error);
    }
    if (base > 0) check((await ctx.supabase.from("transcript_segments").delete().eq("recording_id", recording_id).lt("position", base)).error);
    return { workspaceId: ws, targetId: recording_id, data: { recording_id, segments: segments.length, first_position: base } };
  });

  defineTool(server, ctx, "segment_update", {
    title: "Fix transcript segment",
    description: "Edit one transcript segment by its position (from echo_recording_get with include_transcript).",
    inputSchema: z.object({
      recording_id: id("Recording"),
      position: z.number().int().min(0),
      speaker: z.string().trim().min(1).max(80).optional(),
      start_sec: z.number().int().min(0).optional(),
      text: z.string().trim().min(1).max(10_000).optional(),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, async ({ recording_id, position, ...fields }) => {
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new ToolError("Nothing to change. Pass speaker, start_sec or text.");
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data, error } = await ctx.supabase
      .from("transcript_segments").update(changes).eq("recording_id", recording_id).eq("position", position)
      .select("position, speaker, start_sec, text");
    check(error);
    return { workspaceId: ws, targetId: recording_id, data: { segment: found(data?.[0], "Segment") } };
  });

  defineTool(server, ctx, "segment_delete", {
    title: "Delete transcript segment",
    description: "Permanently remove one transcript segment. Needs confirm: true.",
    inputSchema: z.object({ recording_id: id("Recording"), position: z.number().int().min(0), confirm: confirmArg }),
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, async ({ recording_id, position, confirm }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data: seg, error } = await ctx.supabase
      .from("transcript_segments").select("position, speaker, start_sec, text")
      .eq("recording_id", recording_id).eq("position", position).maybeSingle();
    check(error);
    const s = found(seg, "Segment");
    if (!confirm) return { workspaceId: ws, targetId: recording_id, data: { preview: true, would_delete: s, next: "Call again with confirm: true." } };
    check((await ctx.supabase.from("transcript_segments").delete().eq("recording_id", recording_id).eq("position", position)).error);
    return { workspaceId: ws, targetId: recording_id, data: { deleted: s } };
  });

  defineTool(server, ctx, "highlight_create", {
    title: "Add highlight",
    description: "Add a highlight (a key moment) to a recording.",
    inputSchema: z.object({ recording_id: id("Recording"), text: z.string().trim().min(1).max(2000), start_sec: z.number().int().min(0).default(0) }),
    annotations: { ...WRITE, idempotentHint: false },
  }, async ({ recording_id, text, start_sec }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data, error } = await ctx.supabase.from("highlights").insert({ recording_id, text, start_sec }).select("id, start_sec, text").single();
    check(error);
    return { workspaceId: ws, targetId: data!.id, data: { highlight: data } };
  });

  defineTool(server, ctx, "highlight_update", {
    title: "Edit highlight",
    description: "Change a highlight's text or time.",
    inputSchema: z.object({
      highlight_id: id("Highlight"),
      text: z.string().trim().min(1).max(2000).optional(),
      start_sec: z.number().int().min(0).optional(),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, async ({ highlight_id, ...fields }) => {
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new ToolError("Nothing to change. Pass text or start_sec.");
    const { data, error } = await ctx.supabase.from("highlights").update(changes).eq("id", highlight_id).select("id, recording_id, start_sec, text");
    check(error);
    return { targetId: highlight_id, data: { highlight: found(data?.[0], "Highlight") } };
  });

  defineTool(server, ctx, "highlight_delete", {
    title: "Delete highlight",
    description: "Permanently remove a highlight. Needs confirm: true.",
    inputSchema: z.object({ highlight_id: id("Highlight"), confirm: confirmArg }),
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, async ({ highlight_id, confirm }) => {
    const { data: h, error } = await ctx.supabase.from("highlights").select("id, recording_id, start_sec, text").eq("id", highlight_id).maybeSingle();
    check(error);
    const hl = found(h, "Highlight");
    if (!confirm) return { targetId: highlight_id, data: { preview: true, would_delete: hl, next: "Call again with confirm: true." } };
    check((await ctx.supabase.from("highlights").delete().eq("id", highlight_id)).error);
    return { targetId: highlight_id, data: { deleted: hl } };
  });
}
