import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { resolveWorkspace, workspaceArg } from "../workspace";
import { check, confirmArg, found, id } from "./shared";

export function registerFolderTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "folder_list", {
    title: "List folders",
    description: "Folders with how many active recordings each holds. Omit workspace_id to list folders in all your workspaces.",
    inputSchema: z.object({ workspace_id: workspaceArg }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ workspace_id }) => {
    const ws = workspace_id ? await resolveWorkspace(ctx, workspace_id) : null;
    let q = ctx.supabase.from("folders").select("id, name, workspace_id, created_at, recordings(count)").is("recordings.deleted_at", null);
    if (ws) q = q.eq("workspace_id", ws.id);
    const { data, error } = await q.order("name");
    check(error);
    const folders = (data ?? []).map((f) => ({
      id: f.id, name: f.name, workspace_id: f.workspace_id,
      recordings: (f.recordings as unknown as { count: number }[])[0]?.count ?? 0,
    }));
    return { workspaceId: ws?.id, data: { folders } };
  });

  defineTool(server, ctx, "folder_create", {
    title: "Create folder",
    description: "Create a folder. Goes in your Personal workspace unless you pass workspace_id.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(120), workspace_id: workspaceArg }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ name, workspace_id }) => {
    const ws = await resolveWorkspace(ctx, workspace_id);
    const { data, error } = await ctx.supabase.from("folders").insert({ workspace_id: ws.id, name }).select("id, name, workspace_id").single();
    check(error);
    return { workspaceId: ws.id, targetId: data!.id, data: { folder: data } };
  });

  defineTool(server, ctx, "folder_update", {
    title: "Rename folder",
    description: "Rename a folder.",
    inputSchema: z.object({ folder_id: id("Folder"), name: z.string().trim().min(1).max(120) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ folder_id, name }) => {
    const { data, error } = await ctx.supabase.from("folders").update({ name }).eq("id", folder_id).select("id, name, workspace_id");
    check(error);
    const folder = found(data?.[0], "Folder");
    return { workspaceId: folder.workspace_id, targetId: folder_id, data: { folder } };
  });

  defineTool(server, ctx, "folder_delete", {
    title: "Delete folder",
    description: "Permanently delete a folder. Its recordings are kept and become Unfiled. Needs confirm: true.",
    inputSchema: z.object({ folder_id: id("Folder"), confirm: confirmArg }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ folder_id, confirm }) => {
    const { data: folder, error } = await ctx.supabase
      .from("folders").select("id, name, workspace_id, recordings(count)").eq("id", folder_id).maybeSingle();
    check(error);
    const f = found(folder, "Folder");
    const count = (f.recordings as unknown as { count: number }[])[0]?.count ?? 0;
    if (!confirm) {
      return { workspaceId: f.workspace_id, targetId: folder_id, data: {
        preview: true, would_delete: { folder: f.name, recordings_that_become_unfiled: count },
        next: "Call again with confirm: true to delete.",
      } };
    }
    const del = await ctx.supabase.from("folders").delete().eq("id", folder_id);
    check(del.error);
    return { workspaceId: f.workspace_id, targetId: folder_id, data: { deleted: { folder: f.name }, recordings_unfiled: count } };
  });
}
