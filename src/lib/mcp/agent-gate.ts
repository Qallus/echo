import "server-only";
import type { McpContext, Risk } from "./auth";
import { ToolError, type ToolOutput } from "./audit";

// The limits on an agent, checked before each of its tool calls (people
// connected over OAuth skip this). Returns a result to send back instead of
// running the tool (an approval request), or null to run it.
//   read-only    : only read tools
//   domains      : only tools in these areas (empty = all)
//   caps         : writes and high-risk actions per 24 hours
//   approvals    : high-risk tools, plus any listed, wait for a person
const FREE = new Set(["tool_search", "confirm_status", "agent_whoami", "approval_status", "approval_list", "approval_run"]);

export async function agentGate(
  ctx: McpContext, tool: { name: string; title: string; risk: Risk; domain: string; previewOnly?: boolean }, args: Record<string, unknown>,
): Promise<ToolOutput | null> {
  const a = ctx.agent;
  if (!a || FREE.has(tool.name)) return null;
  if (tool.risk !== "read" && a.read_only) throw new ToolError("This agent is read-only.");
  if (a.domains.length && !a.domains.includes(tool.domain) && tool.domain !== "meta") {
    throw new ToolError(`This agent isn't allowed to use ${tool.domain} tools.`);
  }

  if (tool.risk !== "read") {
    const since = new Date(Date.now() - 864e5).toISOString();
    const names = (risk: Risk[]) => ctx.catalog.filter((t) => risk.includes(t.risk)).map((t) => t.name);
    const count = async (list: string[]) => {
      const { count: n } = await ctx.supabase.from("mcp_audit_log").select("id", { count: "exact", head: true })
        .eq("user_id", ctx.user.id).eq("ok", true).gte("created_at", since).in("tool", list);
      return n ?? 0;
    };
    const writes = a.caps.writes ?? 500;
    if ((await count(names(["write", "high"]))) >= writes) throw new ToolError(`Daily limit reached: ${writes} changes in 24 hours. Ask a person to raise it in Redial Admin.`);
    if (tool.risk === "high") {
      const high = a.caps.high ?? 20;
      if ((await count(names(["high"]))) >= high) throw new ToolError(`Daily limit reached: ${high} high-risk actions in 24 hours.`);
    }
  }

  const needsPerson = (tool.risk === "high" && !tool.previewOnly) || a.approval_tools.includes(tool.name);
  if (!needsPerson || ctx.approvedRun === tool.name) return null;

  let summary = `${tool.title}: ${JSON.stringify(args).slice(0, 300)}`;
  if (tool.name === "confirm_action" && typeof args.confirmation_id === "string") {
    const { data } = await ctx.supabase.from("mcp_confirmations").select("summary").eq("id", args.confirmation_id).maybeSingle();
    if (data?.summary) summary = data.summary;
  }
  const { data, error } = await ctx.supabase.from("agent_approvals")
    .insert({ agent_id: a.id, tool: tool.name, args, summary: summary.slice(0, 2000) }).select("id, expires_at").single();
  if (error) throw new Error(`approval: ${error.message}`);
  return {
    targetId: data.id,
    data: {
      needs_approval: true, approval_id: data.id, expires_at: data.expires_at, summary,
      next: "A person has to approve this in Redial Admin (AI > Agents); they've been notified. Check approval_status, and once it's approved call approval_run with approval_id. Don't retry the tool itself.",
    },
  };
}
