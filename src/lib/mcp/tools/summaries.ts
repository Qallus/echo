import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { resolveWorkspace, workspaceArg } from "../workspace";
import { check, confirmArg, found, id, limitArg, recordingWorkspace } from "./shared";

const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;


export function registerSummaryTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "summary_upsert", {
    title: "Write summary",
    description:
      "Create or replace a recording's summary (you can write it from the transcript) and mark the recording as generated. Add action items separately with echo_action_item_create.",
    inputSchema: z.object({
      recording_id: id("Recording"),
      overview: z.string().trim().min(1).max(20_000),
      key_points: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
      mind_map: z.object({ root: z.string().max(300), branches: z.array(z.string().max(300)).max(30) }).optional(),
      template: z.string().trim().min(1).max(100).default("Adaptive summary"),
      model: z.string().trim().max(100).optional().describe("Which model wrote it, e.g. claude-opus-5-5"),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, async ({ recording_id, mind_map, model, ...rest }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data, error } = await ctx.supabase.from("summaries").upsert({
      recording_id, ...rest, mind_map: mind_map ?? {}, model: model ?? "Claude (via Echo connector)",
    }).select("recording_id, template, model, overview, key_points, mind_map, updated_at").single();
    check(error);
    check((await ctx.supabase.from("recordings").update({ status: "generated" }).eq("id", recording_id)).error);
    return { workspaceId: ws, targetId: recording_id, data: { summary: data } };
  });

  defineTool(server, ctx, "summary_delete", {
    title: "Delete summary",
    description: "Permanently remove a recording's summary. Needs confirm: true.",
    inputSchema: z.object({ recording_id: id("Recording"), confirm: confirmArg }),
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, async ({ recording_id, confirm }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data: s, error } = await ctx.supabase.from("summaries").select("template, overview").eq("recording_id", recording_id).maybeSingle();
    check(error);
    const sum = found(s, "Summary");
    if (!confirm) {
      return { workspaceId: ws, targetId: recording_id, data: {
        preview: true, would_delete: { template: sum.template, overview: sum.overview.slice(0, 300) }, next: "Call again with confirm: true.",
      } };
    }
    check((await ctx.supabase.from("summaries").delete().eq("recording_id", recording_id)).error);
    check((await ctx.supabase.from("recordings").update({ status: "none" }).eq("id", recording_id)).error);
    return { workspaceId: ws, targetId: recording_id, data: { deleted: { recording_id } } };
  });

  defineTool(server, ctx, "action_item_list", {
    title: "List action items",
    description: "Action items across recordings, filtered by done, owner or recording. Omit workspace_id for all your workspaces. Skips recordings in Trash.",
    inputSchema: z.object({
      workspace_id: workspaceArg,
      done: z.boolean().optional(),
      owner: z.string().trim().min(1).max(80).optional().describe("Matches part of the owner's name"),
      recording_id: id("Recording").optional(),
      limit: limitArg,
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    const ws = a.workspace_id ? await resolveWorkspace(ctx, a.workspace_id) : null;
    let q = ctx.supabase
      .from("action_items")
      .select("id, text, owner_name, owner_role, done, recording_id, recordings!inner(title, workspace_id, deleted_at)")
      .is("recordings.deleted_at", null);
    if (ws) q = q.eq("recordings.workspace_id", ws.id);
    if (a.done !== undefined) q = q.eq("done", a.done);
    if (a.owner) q = q.ilike("owner_name", `%${a.owner.replace(/[%_\\]/g, "\\$&")}%`);
    if (a.recording_id) q = q.eq("recording_id", a.recording_id);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(a.limit);
    check(error);
    const items = (data ?? []).map(({ recordings, ...it }) => {
      const r = recordings as unknown as { title: string; workspace_id: string };
      return { ...it, recording_title: r.title, workspace_id: r.workspace_id };
    });
    return { workspaceId: ws?.id, data: { action_items: items } };
  });

  defineTool(server, ctx, "action_item_create", {
    title: "Add action item",
    description: "Add an action item to a recording.",
    inputSchema: z.object({
      recording_id: id("Recording"),
      text: z.string().trim().min(1).max(2000),
      owner_name: z.string().trim().min(1).max(120).optional(),
      owner_role: z.string().trim().min(1).max(120).optional(),
    }),
    annotations: { ...WRITE, idempotentHint: false },
  }, async ({ recording_id, ...item }) => {
    const ws = await recordingWorkspace(ctx, recording_id);
    const { data: last } = await ctx.supabase
      .from("action_items").select("position").eq("recording_id", recording_id).order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await ctx.supabase
      .from("action_items").insert({ recording_id, ...item, position: (last?.position ?? -1) + 1 })
      .select("id, text, owner_name, owner_role, done").single();
    check(error);
    return { workspaceId: ws, targetId: data!.id, data: { action_item: data } };
  });

  defineTool(server, ctx, "action_item_update", {
    title: "Update action item",
    description: "Edit an action item's text or owner, or mark it done/undone.",
    inputSchema: z.object({
      action_item_id: id("Action item"),
      text: z.string().trim().min(1).max(2000).optional(),
      owner_name: z.string().trim().min(1).max(120).nullable().optional(),
      owner_role: z.string().trim().min(1).max(120).nullable().optional(),
      done: z.boolean().optional(),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, async ({ action_item_id, ...fields }) => {
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new ToolError("Nothing to change. Pass text, owner_name, owner_role or done.");
    const { data, error } = await ctx.supabase
      .from("action_items").update(changes).eq("id", action_item_id).select("id, recording_id, text, owner_name, owner_role, done");
    check(error);
    return { targetId: action_item_id, data: { action_item: found(data?.[0], "Action item") } };
  });

  defineTool(server, ctx, "action_item_delete", {
    title: "Delete action item",
    description: "Permanently remove an action item. Needs confirm: true.",
    inputSchema: z.object({ action_item_id: id("Action item"), confirm: confirmArg }),
    annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  }, async ({ action_item_id, confirm }) => {
    const { data: it, error } = await ctx.supabase.from("action_items").select("id, recording_id, text, owner_name").eq("id", action_item_id).maybeSingle();
    check(error);
    const item = found(it, "Action item");
    if (!confirm) return { targetId: action_item_id, data: { preview: true, would_delete: item, next: "Call again with confirm: true." } };
    check((await ctx.supabase.from("action_items").delete().eq("id", action_item_id)).error);
    return { targetId: action_item_id, data: { deleted: item } };
  });
}
