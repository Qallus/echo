import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { resolveWorkspace, workspaceArg } from "../workspace";
import { check, id } from "./shared";

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

export function registerAccountTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "whoami", {
    title: "Who am I",
    description: "The signed-in Echo user, the workspace tools act in by default (Personal), your role there, and the connected app.",
    inputSchema: z.object({ workspace_id: workspaceArg }),
    annotations: READ,
  }, async ({ workspace_id }) => {
    const ws = await resolveWorkspace(ctx, workspace_id);
    return {
      workspaceId: ws.id,
      data: { user: { id: ctx.user.id, email: ctx.user.email }, workspace: ws, client_id: ctx.user.clientId || null },
    };
  });

  defineTool(server, ctx, "workspace_list", {
    title: "List workspaces",
    description: "Your workspaces: Personal (only you) and any Business workspaces (shared with the team), with your role in each.",
    inputSchema: z.object({}),
    annotations: READ,
  }, async () => {
    const { data, error } = await ctx.supabase
      .from("workspace_members").select("role, workspaces!inner(id, name, is_personal)").eq("user_id", ctx.user.id);
    check(error);
    const workspaces = (data ?? []).map((m) => {
      const w = m.workspaces as unknown as { id: string; name: string; is_personal: boolean };
      return { id: w.id, name: w.name, kind: w.is_personal ? "personal" : "business", role: m.role };
    });
    return { data: { workspaces } };
  });

  defineTool(server, ctx, "workspace_update", {
    title: "Rename workspace",
    description: "Rename a Business workspace (owner or admin only).",
    inputSchema: z.object({ workspace_id: id("Workspace"), name: z.string().trim().min(1).max(120) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ workspace_id, name }) => {
    const { data, error } = await ctx.supabase.from("workspaces").update({ name }).eq("id", workspace_id).select("id, name");
    check(error);
    if (!data?.length) throw new ToolError("Workspace not found, or only owners and admins can rename it.");
    return { workspaceId: workspace_id, targetId: workspace_id, data: { workspace: data[0] } };
  });

  defineTool(server, ctx, "member_list", {
    title: "List members",
    description: "People in a workspace with their roles and emails. Defaults to your Personal workspace.",
    inputSchema: z.object({ workspace_id: workspaceArg }),
    annotations: READ,
  }, async ({ workspace_id }) => {
    const ws = await resolveWorkspace(ctx, workspace_id);
    const { data, error } = await ctx.supabase.rpc("list_workspace_members", { ws: ws.id });
    check(error);
    return { workspaceId: ws.id, data: { workspace: { id: ws.id, name: ws.name }, members: data } };
  });
}
