import "server-only";
import { z } from "zod";
import type { WorkspaceRole } from "@/lib/types";
import type { McpContext } from "./auth";
import { ToolError } from "./audit";

export type McpWorkspace = { id: string; name: string; role: WorkspaceRole; is_personal: boolean };

// Optional argument on every workspace-scoped tool.
export const workspaceArg = z
  .uuid()
  .optional()
  .describe("Workspace to act in. Defaults to your personal workspace.");

// The given workspace if you're a member, otherwise your personal one.
export async function resolveWorkspace(ctx: McpContext, workspaceId?: string): Promise<McpWorkspace> {
  let q = ctx.supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, is_personal)")
    .eq("user_id", ctx.user.id);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data, error } = await q
    .order("is_personal", { referencedTable: "workspaces", ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`workspace lookup: ${error.message}`);
  if (!data) throw new ToolError(workspaceId ? "Workspace not found or you're not a member." : "You don't have a workspace yet.");
  const ws = data.workspaces as unknown as { id: string; name: string; is_personal: boolean };
  return { id: ws.id, name: ws.name, is_personal: ws.is_personal, role: data.role as WorkspaceRole };
}
