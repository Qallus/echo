import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { resolveWorkspace, workspaceArg } from "../workspace";

export function registerAccountTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    "whoami",
    {
      title: "Who am I",
      description: "The signed-in Echo user, the workspace tools act in by default, your role there, and the connected app.",
      inputSchema: z.object({ workspace_id: workspaceArg }),
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ workspace_id }) => {
      const ws = await resolveWorkspace(ctx, workspace_id);
      return {
        workspaceId: ws.id,
        data: {
          user: { id: ctx.user.id, email: ctx.user.email },
          workspace: ws,
          client_id: ctx.user.clientId || null,
        },
      };
    },
  );
}
