import "server-only";
import type { CallToolResult, McpServer, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { McpContext } from "./auth";

const MAX_RESULT_CHARS = 20_000;

// A failure the caller should see as-is ("Recording not found or you don't have access").
export class ToolError extends Error {}

export type ToolOutput = { data: unknown; targetId?: string | null; workspaceId?: string | null };

// Appends to mcp_audit_log. Never throws: a failed audit write must not fail the tool.
export async function audit(
  ctx: McpContext,
  entry: { tool: string; ok: boolean; targetId?: string | null; workspaceId?: string | null; error?: string },
) {
  try {
    const { error } = await ctx.supabase.from("mcp_audit_log").insert({
      user_id: ctx.user.id,
      client_id: ctx.user.clientId || null,
      tool: entry.tool,
      target_id: entry.targetId ?? null,
      workspace_id: entry.workspaceId ?? null,
      ok: entry.ok,
      error: entry.error?.slice(0, 500) ?? null,
    });
    if (error) console.error(`[mcp:audit] ${entry.tool}`, error.message);
  } catch (e) {
    console.error(`[mcp:audit] ${entry.tool}`, e);
  }
}

function text(value: unknown, isError = false): CallToolResult {
  let body = typeof value === "string" ? value : JSON.stringify(value);
  if (body.length > MAX_RESULT_CHARS) body = `${body.slice(0, MAX_RESULT_CHARS)}… [truncated; narrow the request or page with limit/cursor]`;
  return { content: [{ type: "text", text: body }], ...(isError ? { isError: true } : {}) };
}

// Registers an `echo_`-prefixed tool whose every call is audited and whose
// errors come back as plain sentences (never SQL or stack traces).
export function defineTool<S extends z.ZodObject>(
  server: McpServer,
  ctx: McpContext,
  name: string,
  config: { title: string; description: string; inputSchema: S; annotations: ToolAnnotations },
  run: (args: z.infer<S>) => Promise<ToolOutput>,
) {
  const tool = `echo_${name}`;
  // Widened to a concrete ZodObject so the SDK's overloads resolve; the SDK has
  // already validated args against this schema when the callback runs.
  const inputSchema: z.ZodObject = config.inputSchema;
  server.registerTool(tool, { ...config, inputSchema }, async (args) => {
    try {
      const out = await run(args as z.infer<S>);
      await audit(ctx, { tool, ok: true, targetId: out.targetId, workspaceId: out.workspaceId });
      return text(out.data);
    } catch (e) {
      const message = e instanceof ToolError ? e.message : "Something went wrong. Try again.";
      if (!(e instanceof ToolError)) console.error(`[mcp] ${tool}`, e);
      await audit(ctx, { tool, ok: false, error: e instanceof Error ? e.message : String(e) });
      return text(message, true);
    }
  });
}
