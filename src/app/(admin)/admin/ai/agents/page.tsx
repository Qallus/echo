import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { requireStaff } from "@/lib/admin/guard";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { AgentsView, type AgentRow, type ApprovalRow } from "./agents-view";
import { TasksView } from "./tasks-view";
import type { AgentTask, AgentTaskRun } from "@/lib/agents/tasks";

export const metadata = { title: "Agents · Admin · Redial" };

// AI agents that run the business through the MCP (Paperclip, Hermes,
// OpenClaw, Herdr...): their keys, what each may do, and the actions waiting
// for a person's approval.
export default async function AgentsPage() {
  const staff = await requireStaff("staff.manage");
  const supabase = await createClient();
  const [{ data: agents }, { data: activity }, { data: approvals }, tasks, { data: runs }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at"),
    supabase.rpc("admin_agent_activity"),
    supabase.from("agent_approvals").select("id, agent_id, tool, args, summary, status, expires_at, created_at, decided_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("agent_tasks").select("*").order("next_run_at").limit(500),
    supabase.from("agent_task_runs").select("id, task_id, agent_id, ok, result, links, started_at, finished_at").order("finished_at", { ascending: false }).limit(500),
  ]);
  const act = new Map(((activity ?? []) as { agent_id: string; calls_24h: number; failed_24h: number; last_call_at: string | null }[]).map((a) => [a.agent_id, a]));
  const rows: AgentRow[] = ((agents ?? []) as Omit<AgentRow, "calls_24h" | "failed_24h" | "last_call_at">[]).map((a) => ({
    ...a, calls_24h: Number(act.get(a.id)?.calls_24h ?? 0), failed_24h: Number(act.get(a.id)?.failed_24h ?? 0), last_call_at: act.get(a.id)?.last_call_at ?? null,
  }));
  const list = (approvals ?? []) as ApprovalRow[];
  const pending = list.filter((x) => x.status === "pending" && new Date(x.expires_at) > new Date());

  return (
    <AdminPage title="Agents" description="AI agents that work through the Redial MCP with their own key and limits. Everything they do is logged.">
      <div className="stat-row grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agents" value={rows.length} />
        <StatCard label="Active" value={rows.filter((a) => a.active).length} />
        <StatCard label="Waiting for you" value={pending.length} />
        <StatCard label="Calls (24 hours)" value={rows.reduce((n, a) => n + a.calls_24h, 0)} />
      </div>
      <section id="tasks" className="scroll-mt-20">
        <Section title="Tasks" description="Work for your agents: one-off or on a schedule. They take it when it's due, do it with Redial's tools, and report back here.">
          <TasksView tasks={(tasks.data ?? []) as AgentTask[]} runs={(runs ?? []) as AgentTaskRun[]} agents={rows.map((a) => ({ id: a.id, name: a.name }))} setup={!tasks.error} />
        </Section>
      </section>
      <Section title="Agents">
        <AgentsView agents={rows} approvals={list} myPermissions={staff.permissions} mcpUrl={siteUrl("/api/mcp")} />
      </Section>
    </AdminPage>
  );
}
