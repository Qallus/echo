import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { METRICS } from "@/lib/admin/metrics";
import { RANGES, rangeDates, type RangeId } from "@/lib/admin/ranges";
import { REPORTS, reportDef } from "@/lib/admin/reports";
import { loadOrganization } from "@/lib/settings/organization";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { check, found } from "./shared";

// Reports, analytics and the waitlist export: the same numbers as Admin ->
// Reports and Analytics (public.admin_report / admin_series), counted in the
// organization's time zone. Read-only.

const rangeArg = z.enum(["custom", ...RANGES.map((r) => r.id)] as [RangeId, ...RangeId[]]).default("30d");
const dates = { since: z.iso.date().optional().describe("For range custom"), until: z.iso.date().optional().describe("For range custom") };

async function period(ctx: McpContext, range: RangeId, since?: string, until?: string) {
  if (range === "custom" && (!since || !until || since > until)) throw new ToolError("A custom range needs since and until (YYYY-MM-DD), with since first.");
  const org = await loadOrganization(ctx.supabase);
  return { ...rangeDates(range, org.timezone, { since, until }), timezone: org.timezone };
}

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function registerInsightTools(server: McpServer, ctx: McpContext, perms: string[]) {
  const base = { prefix: "", risk: "read" as const };
  const reports = REPORTS.filter((r) => perms.includes(r.needs));
  const metrics = METRICS.filter((m) => !m.needs || perms.includes(m.needs));

  if (perms.includes("analytics.view") && reports.length) {
    defineTool(server, ctx, "reports_run", {
      ...base, domain: "reports", title: "Run a report",
      description: `Runs a report from Admin -> Reports, or a saved report by saved_report_id. Money is in cents. Reports: ${reports.map((r) => `${r.kind} (${r.description})`).join(" ")}`,
      inputSchema: z.object({
        kind: z.enum(reports.map((r) => r.kind) as [string, ...string[]]).optional(), saved_report_id: z.uuid().optional(), range: rangeArg, ...dates,
      }),
    }, async ({ kind, saved_report_id, range, since, until }) => {
      let ask = { kind, range, since, until };
      if (saved_report_id) {
        const { data, error } = await ctx.supabase.from("saved_reports").select("name, kind, range, since, until").eq("id", saved_report_id).maybeSingle();
        check(error);
        const saved = found(data, "Saved report");
        ask = { kind: saved.kind, range: saved.range ?? "90d", since: saved.since ?? undefined, until: saved.until ?? undefined };
      }
      const def = reportDef(ask.kind);
      if (!def || !reports.includes(def)) throw new ToolError("Pick a report kind (or a saved_report_id) you have access to.");
      const p = await period(ctx, ask.range as RangeId, ask.since, ask.until);
      const { data, error } = await ctx.supabase.rpc("admin_report", { p_kind: def.kind, p_since: p.since, p_until: p.until });
      check(error);
      return { targetId: saved_report_id ?? null, data: { report: def.title, since: p.since, until: p.until, timezone: p.timezone, columns: def.columns, rows: data ?? [] } };
    });

    defineTool(server, ctx, "analytics_series", {
      ...base, domain: "analytics", title: "Analytics over time",
      description: `Numbers over time from Admin -> Analytics, bucketed by day, week or month to suit the range. Money is in cents. Metrics: ${metrics.map((m) => `${m.id} (${m.title})`).join(", ")}.`,
      inputSchema: z.object({ metrics: z.array(z.enum(metrics.map((m) => m.id) as [string, ...string[]])).min(1).max(10), range: rangeArg, ...dates }),
    }, async ({ metrics: ids, range, since, until }) => {
      const p = await period(ctx, range, since, until);
      const series = await Promise.all(ids.map(async (metric) => {
        const { data, error } = await ctx.supabase.rpc("admin_series", { p_metric: metric, p_bucket: p.by, p_since: p.since, p_until: p.until });
        check(error);
        const points = ((data ?? []) as { bucket: string; value: number }[]).map((x) => ({ bucket: x.bucket, value: Number(x.value) }));
        const m = metrics.find((x) => x.id === metric)!;
        return { metric, title: m.title, unit: m.unit, total: points.reduce((n, x) => n + x.value, 0), points };
      }));
      return { data: { since: p.since, until: p.until, bucket: p.by, timezone: p.timezone, series } };
    });
  }

  if (perms.includes("comms.view")) {
    defineTool(server, ctx, "waitlist_export", {
      ...base, domain: "waitlist", title: "Export the app waitlist",
      description: "Counts for the Redial app waitlist (by status, platform, product and account type), plus one page of people as CSV (50 per page; pass next_offset for the next). Respect each person's consent and chosen SMS frequency before contacting them.",
      inputSchema: z.object({
        status: z.enum(["waiting", "notified", "invited", "joined", "unsubscribed"]).optional(),
        offset: z.number().int().min(0).max(100000).default(0),
      }),
    }, async ({ status, offset }) => {
      let all = ctx.supabase.from("app_waitlist").select("status, platforms, products, account_type").limit(20000);
      let page = ctx.supabase.from("app_waitlist")
        .select("first_name, last_name, email, phone, platforms, products, account_type, company, team_size, status, consent_email, consent_sms, sms_frequency, update_topics, created_at")
        .order("created_at", { ascending: false }).range(offset, offset + 49);
      if (status) { all = all.eq("status", status); page = page.eq("status", status); }
      const [counts, rows] = await Promise.all([all, page]);
      check(counts.error); check(rows.error);
      const tally = (pick: (r: Record<string, unknown>) => unknown) => {
        const out: Record<string, number> = {};
        for (const r of counts.data ?? []) for (const k of [pick(r)].flat()) if (k) out[String(k)] = (out[String(k)] ?? 0) + 1;
        return out;
      };
      const people = (rows.data ?? []) as Record<string, unknown>[];
      const cols = ["first_name", "last_name", "email", "phone", "platforms", "products", "account_type", "company", "team_size", "status", "consent_email", "consent_sms", "sms_frequency", "update_topics", "created_at"];
      return {
        data: {
          total: counts.data?.length ?? 0,
          by_status: tally((r) => r.status), by_platform: tally((r) => r.platforms), by_product: tally((r) => r.products), by_account_type: tally((r) => r.account_type),
          csv: [cols.join(","), ...people.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n"),
          next_offset: people.length === 50 ? offset + 50 : null,
        },
      };
    });
  }
}
