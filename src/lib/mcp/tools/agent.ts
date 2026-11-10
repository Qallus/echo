import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { check, found, id } from "./shared";

// Tools only an AI agent gets: what it's allowed to do, and following up on
// actions that wait for a person's approval.
export function registerAgentTools(server: McpServer, ctx: McpContext) {
  const agent = ctx.agent;
  if (!agent) return;
  const base = { prefix: "", domain: "meta" } as const;

  defineTool(server, ctx, "agent_whoami", {
    ...base, risk: "read", title: "This agent's access",
    description: "Your name, permissions and limits as an agent, and how much of today's limits you've used. Call this first.",
    inputSchema: z.object({}),
  }, async () => {
    const since = new Date(Date.now() - 864e5).toISOString();
    const { data } = await ctx.supabase.from("mcp_audit_log").select("tool").eq("user_id", ctx.user.id).eq("ok", true).gte("created_at", since).limit(5000);
    const risk = new Map(ctx.catalog.map((t) => [t.name, t.risk]));
    const used = { writes: 0, high: 0 };
    for (const r of data ?? []) { const k = risk.get(r.tool); if (k === "write" || k === "high") used.writes++; if (k === "high") used.high++; }
    return {
      data: {
        agent: { name: agent.name, harness: agent.harness }, permissions: agent.permissions, read_only: agent.read_only,
        domains: agent.domains.length ? agent.domains : "all", always_ask_before: agent.approval_tools,
        limits_per_24h: { writes: agent.caps.writes ?? 500, high: agent.caps.high ?? 20 }, used_last_24h: used, expires_at: agent.expires_at,
        rules: "High-risk actions (deletes, sends, money, access) and any tool in always_ask_before wait for a person: you get needs_approval and an approval_id. Check approval_status; once approved, call approval_run.",
      },
    };
  });

  defineTool(server, ctx, "approval_list", {
    ...base, risk: "read", title: "List my approval requests",
    description: "Your recent requests and whether each is pending, approved, declined or already used.",
    inputSchema: z.object({ status: z.enum(["pending", "approved", "declined", "used"]).optional() }),
  }, async ({ status }) => {
    let q = ctx.supabase.from("agent_approvals").select("id, tool, summary, status, expires_at, created_at, decided_at").eq("agent_id", agent.id);
    if (status) q = q.eq("status", status);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(50);
    check(error);
    return { data: { approvals: data ?? [] } };
  });

  defineTool(server, ctx, "approval_status", {
    ...base, risk: "read", title: "Check an approval",
    description: "Whether a person has approved or declined a request yet.",
    inputSchema: z.object({ approval_id: id("Approval") }),
  }, async ({ approval_id }) => {
    const { data, error } = await ctx.supabase.from("agent_approvals").select("id, tool, summary, status, expires_at, decided_at").eq("id", approval_id).maybeSingle();
    check(error);
    const a = found(data, "Approval");
    const expired = a.status !== "used" && new Date(a.expires_at) <= new Date();
    return { targetId: approval_id, data: { ...a, status: expired && a.status !== "declined" ? "expired" : a.status } };
  });

  defineTool(server, ctx, "approval_run", {
    ...base, risk: "write", title: "Run an approved action",
    description: "Runs an action a person approved, exactly as you asked for it. Works once, before it expires.",
    inputSchema: z.object({ approval_id: id("Approval") }),
  }, async ({ approval_id }) => {
    // Claim it: RLS only lets the agent mark its own approved, unexpired request used.
    const { data, error } = await ctx.supabase.from("agent_approvals").update({ status: "used" })
      .eq("id", approval_id).eq("status", "approved").select("tool, args").maybeSingle();
    check(error);
    if (!data) throw new ToolError("That request isn't approved, has expired, or was already used. Check approval_status.");
    const run = ctx.handlers.get(data.tool);
    if (!run) throw new ToolError("That tool isn't available to you any more.");
    ctx.approvedRun = data.tool;
    try {
      const res = await run(data.args as Record<string, unknown>);
      const body = res.content?.[0]?.type === "text" ? res.content[0].text : "";
      let parsed: unknown = body;
      try { parsed = JSON.parse(body); } catch {}
      if (res.isError) throw new ToolError(`${data.tool} failed: ${body}`);
      return { targetId: approval_id, data: { ran: data.tool, result: parsed } };
    } finally {
      ctx.approvedRun = undefined;
    }
  });
}
