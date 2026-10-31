import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { relocateAudio } from "@/lib/storage";
import { resolveWorkspace, workspaceArg } from "../workspace";
import {
  check, confirmArg, cursorArg, cursorFilter, decodeCursor, found, id, limitArg, nextCursor, SOURCES, STATUSES,
} from "./shared";

const COLS = "id, title, workspace_id, folder_id, source, status, duration_sec, created_at, deleted_at";
const TRANSCRIPT_PAGE_CHARS = 12_000;
const MAX_TRANSCRIPT_CHARS = 200_000;

// "[00:12] Ana: hello" / "Ana: hello" / "hello" -> segments.
function parseTranscript(text: string) {
  const segments: { speaker: string; start_sec: number; text: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    let start = segments.at(-1)?.start_sec ?? 0;
    const ts = line.match(/^\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*/);
    if (ts) {
      start = Number(ts[1] ?? 0) * 3600 + Number(ts[2]) * 60 + Number(ts[3]);
      line = line.slice(ts[0].length);
    }
    const sp = line.match(/^([^:]{1,40}):\s+(.+)$/);
    segments.push({ speaker: sp ? sp[1].trim() : "Speaker", start_sec: start, text: (sp ? sp[2] : line).slice(0, 10_000) });
  }
  return segments;
}

async function getRecording(ctx: McpContext, recordingId: string) {
  const { data, error } = await ctx.supabase.from("recordings").select(`${COLS}, storage_path, created_by`).eq("id", recordingId).maybeSingle();
  check(error);
  return found(data, "Recording");
}

export function registerRecordingTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "recording_list", {
    title: "List recordings",
    description: "List recordings, newest first. Omit workspace_id to include all your workspaces (each row has its workspace_id). Pages with limit/cursor.",
    inputSchema: z.object({
      workspace_id: workspaceArg,
      view: z.enum(["all", "unfiled", "trash"]).default("all").describe("all = active recordings; trash = moved to Trash"),
      folder_id: id("Folder").optional(),
      source: z.enum(SOURCES).optional(),
      status: z.enum(STATUSES).optional(),
      limit: limitArg,
      cursor: cursorArg,
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    const ws = a.workspace_id ? await resolveWorkspace(ctx, a.workspace_id) : null;
    let q = ctx.supabase.from("recordings").select(COLS);
    if (ws) q = q.eq("workspace_id", ws.id);
    q = a.view === "trash" ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    if (a.view === "unfiled") q = q.is("folder_id", null);
    if (a.folder_id) q = q.eq("folder_id", a.folder_id);
    if (a.source) q = q.eq("source", a.source);
    if (a.status) q = q.eq("status", a.status);
    const cursor = decodeCursor(a.cursor);
    if (cursor) q = q.or(cursorFilter(cursor));
    const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(a.limit);
    check(error);
    return { workspaceId: ws?.id, data: { recordings: data, next_cursor: nextCursor(data ?? [], a.limit) } };
  });

  defineTool(server, ctx, "recording_get", {
    title: "Get recording",
    description: "One recording with its summary, action items and highlights. Set include_transcript for the transcript, paged by transcript_offset.",
    inputSchema: z.object({
      recording_id: id("Recording"),
      include_transcript: z.boolean().default(false),
      transcript_offset: z.number().int().min(0).default(0).describe("Segment index to start from (use next_offset)"),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ recording_id, include_transcript, transcript_offset }) => {
    const rec = await getRecording(ctx, recording_id);
    const [sum, items, hls] = await Promise.all([
      ctx.supabase.from("summaries").select("template, model, overview, key_points, mind_map, updated_at").eq("recording_id", recording_id).maybeSingle(),
      ctx.supabase.from("action_items").select("id, text, owner_name, owner_role, done").eq("recording_id", recording_id).order("position"),
      ctx.supabase.from("highlights").select("id, start_sec, text").eq("recording_id", recording_id).order("start_sec"),
    ]);
    check(sum.error); check(items.error); check(hls.error);

    let transcript: unknown = undefined;
    if (include_transcript) {
      const { data: segs, error, count } = await ctx.supabase
        .from("transcript_segments").select("position, speaker, start_sec, text", { count: "exact" })
        .eq("recording_id", recording_id).order("position").range(transcript_offset, transcript_offset + 499);
      check(error);
      const page: typeof segs = [];
      let chars = 0;
      for (const s of segs ?? []) {
        if (page.length && chars + s.text.length > TRANSCRIPT_PAGE_CHARS) break;
        page.push(s);
        chars += s.text.length;
      }
      const next = transcript_offset + page.length;
      transcript = { segments: page, offset: transcript_offset, total: count ?? 0, next_offset: next < (count ?? 0) ? next : null };
    }

    const { storage_path, created_by, ...recording } = rec;
    return {
      workspaceId: rec.workspace_id, targetId: recording_id,
      data: {
        recording: { ...recording, has_audio: Boolean(storage_path), created_by },
        summary: sum.data, action_items: items.data, highlights: hls.data, transcript,
      },
    };
  });

  defineTool(server, ctx, "recording_create", {
    title: "Create recording",
    description:
      "Create a recording record from metadata or a pasted transcript (lines like '[00:12] Ana: text' or 'Ana: text'). Goes in your Personal workspace unless you pass workspace_id.",
    inputSchema: z.object({
      title: z.string().trim().min(1).max(300),
      source: z.enum(SOURCES).default("upload"),
      workspace_id: workspaceArg,
      folder_id: id("Folder").optional().describe("Folder in the same workspace"),
      duration_sec: z.number().int().min(0).max(86_400 * 2).optional(),
      transcript_text: z.string().max(MAX_TRANSCRIPT_CHARS).optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (a) => {
    const ws = await resolveWorkspace(ctx, a.workspace_id);
    const segments = a.transcript_text ? parseTranscript(a.transcript_text) : [];
    const duration = a.duration_sec ?? (segments.at(-1)?.start_sec ?? 0);
    const { data: rec, error } = await ctx.supabase.from("recordings").insert({
      workspace_id: ws.id, created_by: ctx.user.id, folder_id: a.folder_id ?? null,
      title: a.title, source: a.source, duration_sec: duration,
    }).select(COLS).single();
    check(error);
    for (let i = 0; i < segments.length; i += 500) {
      const chunk = segments.slice(i, i + 500).map((s, j) => ({ ...s, recording_id: rec!.id, position: i + j }));
      check((await ctx.supabase.from("transcript_segments").insert(chunk)).error);
    }
    return { workspaceId: ws.id, targetId: rec!.id, data: { recording: rec, transcript_segments: segments.length } };
  });

  defineTool(server, ctx, "recording_update", {
    title: "Update recording",
    description:
      "Edit title, folder (null to unfile), source or status, or move it to another workspace with workspace_id (Business <-> Personal; only its creator or an owner/admin; the folder is cleared unless you also pass folder_id from the new workspace).",
    inputSchema: z.object({
      recording_id: id("Recording"),
      title: z.string().trim().min(1).max(300).optional(),
      folder_id: id("Folder").nullable().optional(),
      source: z.enum(SOURCES).optional(),
      status: z.enum(STATUSES).optional(),
      workspace_id: z.uuid().optional().describe("Move to this workspace"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ recording_id, workspace_id, ...fields }) => {
    const before = await getRecording(ctx, recording_id);
    if (workspace_id && workspace_id !== before.workspace_id) {
      const { error } = await ctx.supabase.from("recordings").update({ workspace_id }).eq("id", recording_id);
      check(error);
      try { await relocateAudio(ctx.supabase, recording_id); } catch (e) { throw new ToolError(e instanceof Error ? e.message : String(e)); }
    }
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      const { error } = await ctx.supabase.from("recordings").update(changes).eq("id", recording_id);
      check(error);
    }
    if (!workspace_id && !Object.keys(changes).length) throw new ToolError("Nothing to change. Pass at least one field.");
    const { data: after, error } = await ctx.supabase.from("recordings").select(COLS).eq("id", recording_id).maybeSingle();
    check(error);
    const recording = found(after, "Recording");
    return { workspaceId: recording.workspace_id, targetId: recording_id, data: { recording } };
  });

  for (const [name, trash] of [["recording_trash", true], ["recording_restore", false]] as const) {
    defineTool(server, ctx, name, {
      title: trash ? "Move recording to Trash" : "Restore recording",
      description: trash
        ? "Move a recording to Trash (soft delete; restore it later, or purge it to delete permanently)."
        : "Restore a recording from Trash.",
      inputSchema: z.object({ recording_id: id("Recording") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ recording_id }) => {
      const { data, error } = await ctx.supabase
        .from("recordings").update({ deleted_at: trash ? new Date().toISOString() : null })
        .eq("id", recording_id).select("id, title, workspace_id, deleted_at");
      check(error);
      const rec = found(data?.[0], "Recording");
      return { workspaceId: rec.workspace_id, targetId: recording_id, data: { recording: rec } };
    });
  }

  defineTool(server, ctx, "recording_purge", {
    title: "Permanently delete recording",
    description:
      "Permanently delete a recording that is already in Trash, with its transcript, summary, highlights, action items and audio file. Needs confirm: true. Only its creator or an owner/admin.",
    inputSchema: z.object({ recording_id: id("Recording"), confirm: confirmArg }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ recording_id, confirm }) => {
    const rec = await getRecording(ctx, recording_id);
    if (!rec.deleted_at) throw new ToolError("Move the recording to Trash first (echo_recording_trash), then purge it.");
    if (!confirm) {
      const { count } = await ctx.supabase.from("transcript_segments").select("id", { count: "exact", head: true }).eq("recording_id", recording_id);
      return { workspaceId: rec.workspace_id, targetId: recording_id, data: {
        preview: true,
        would_delete: { title: rec.title, transcript_segments: count ?? 0, audio_file: Boolean(rec.storage_path) },
        next: "Call again with confirm: true to delete permanently. This can't be undone.",
      } };
    }
    const { error, count } = await ctx.supabase.from("recordings").delete({ count: "exact" }).eq("id", recording_id);
    check(error);
    if (!count) throw new ToolError("Only the person who made this recording, or a workspace owner/admin, can delete it permanently.");
    let audioRemoved = false;
    if (rec.storage_path) {
      const { error: sErr } = await ctx.supabase.storage.from("recordings").remove([rec.storage_path]);
      audioRemoved = !sErr;
      if (sErr) console.error("[mcp] purge audio", sErr.message);
    }
    return { workspaceId: rec.workspace_id, targetId: recording_id, data: { deleted: { title: rec.title }, audio_removed: audioRemoved } };
  });

  defineTool(server, ctx, "search", {
    title: "Search recordings",
    description: "Full-text search of recording titles, transcripts and summaries. Omit workspace_id to search all your workspaces.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(200),
      workspace_id: workspaceArg,
      limit: z.number().int().min(1).max(50).default(20),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ query, workspace_id, limit }) => {
    const ws = workspace_id ? await resolveWorkspace(ctx, workspace_id) : null;
    const { data, error } = await ctx.supabase.rpc("search_recordings", { query, ws: ws?.id ?? null, max_results: limit });
    check(error);
    return { workspaceId: ws?.id, data: { results: data } };
  });
}
