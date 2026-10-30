import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { check, limitArg } from "./shared";

export function registerActivityTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "audit_log_list", {
    title: "Recent connector activity",
    description: "Your most recent Echo connector calls: time, app, tool, target and whether it succeeded.",
    inputSchema: z.object({ limit: limitArg }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ limit }) => {
    const { data, error } = await ctx.supabase
      .from("mcp_audit_log").select("created_at, client_id, tool, target_id, workspace_id, ok, error")
      .order("created_at", { ascending: false }).limit(limit);
    check(error);
    return { data: { activity: data } };
  });
}
