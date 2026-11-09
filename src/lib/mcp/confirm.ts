import "server-only";
import type { McpContext } from "./auth";
import { ToolError, type ToolOutput } from "./audit";
import { check } from "./tools/shared";

// High-risk actions run in two steps: the tool returns a preview and a
// confirmation id (mcp_confirmations, valid 15 minutes, once, only for the
// person and app that asked), the person says yes, then confirm_action runs
// it. Each action registers the code that runs it here. (Email sends keep
// their own echo_email_send_confirm.)

type Handler = (ctx: McpContext, payload: Record<string, unknown>) => Promise<ToolOutput>;
const HANDLERS = new Map<string, Handler>();

export function confirmable(action: string, run: Handler) {
  HANDLERS.set(action, run);
}

// Stores the pending action and returns what the caller shows the person.
export async function prepare(ctx: McpContext, action: string, payload: Record<string, unknown>, summary: string, preview?: unknown): Promise<ToolOutput> {
  if (!HANDLERS.has(action)) throw new Error(`No confirm handler for ${action}`);
  const { data, error } = await ctx.supabase.from("mcp_confirmations")
    .insert({ client_id: ctx.user.clientId || null, tool: action, payload, summary: summary.slice(0, 2000) })
    .select("id, expires_at").single();
  check(error);
  return {
    data: {
      needs_confirmation: true, ask: `${summary}?`, preview, confirmation_id: data!.id, expires_at: data!.expires_at,
      next: "Show the person what will happen and ask. Only after a clear yes, call confirm_action with confirmation_id. If they say no, do nothing.",
    },
  };
}

// Claims a confirmation (once) and runs its action.
export async function runConfirmed(ctx: McpContext, confirmationId: string): Promise<ToolOutput> {
  let q = ctx.supabase.from("mcp_confirmations").update({ used_at: new Date().toISOString() })
    .eq("id", confirmationId).is("used_at", null).neq("tool", "email_send");
  q = ctx.user.clientId ? q.eq("client_id", ctx.user.clientId) : q.is("client_id", null);
  const { data, error } = await q.select("tool, payload").maybeSingle();
  check(error);
  if (!data) throw new ToolError("That confirmation has expired, was already used, or isn't yours. Ask for the action again.");
  const run = HANDLERS.get(data.tool);
  if (!run) throw new ToolError("That action can't be confirmed here.");
  return run(ctx, data.payload as Record<string, unknown>);
}

export async function confirmationStatus(ctx: McpContext, confirmationId: string) {
  const { data, error } = await ctx.supabase.from("mcp_confirmations").select("tool, summary, expires_at, used_at, created_at").eq("id", confirmationId).maybeSingle();
  check(error);
  if (!data) throw new ToolError("Confirmation not found or it isn't yours.");
  const status = data.used_at ? "used" : new Date(data.expires_at) < new Date() ? "expired" : "pending";
  return { status, action: data.tool, summary: data.summary, expires_at: data.expires_at, used_at: data.used_at };
}
