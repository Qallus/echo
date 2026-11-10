import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { adminAudit } from "@/lib/admin/audit";
import { PIPELINE_PATH, STAGES, STAGE_ORDER, type DealStage } from "@/lib/crm/deals";
import { blockingSteps, parseStageConfig, resolveStage, stepsFor, type StageConfig } from "@/lib/crm/guidance";
import { contactsToDeals, importContactRows, moveDealStage, type ImportRow } from "@/lib/crm/ops";
import type { Deal } from "@/lib/crm/types";
import { createPlanFromTemplate } from "@/lib/plans/create";
import { PLAN_TEMPLATES } from "@/lib/plans/templates";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { check, found, id } from "./shared";

// CRM and operations actions that have rules the generic resource_* tools
// can't express: stage moves that follow the checklist, lead -> deal, a
// confirmed import, booking status, plans from templates, document links.
// Staff only (crm.view to read, crm.manage to change; RLS checks again).

const stageArg = z.enum(STAGE_ORDER as [DealStage, ...DealStage[]]);
const result = (r: { ok?: string; error?: string }) => { if (r.error) throw new ToolError(r.error === "Not found." ? "Deal not found or you don't have access." : r.error); return r.ok; };

async function stageConfig(ctx: McpContext): Promise<StageConfig> {
  const { data } = await ctx.supabase.from("platform_settings").select("value").eq("key", "crm_stages").maybeSingle();
  return parseStageConfig(data?.value);
}
async function loadDeal(ctx: McpContext, dealId: string): Promise<Deal> {
  const { data, error } = await ctx.supabase.from("crm_deals").select("*").eq("id", dealId).maybeSingle();
  check(error);
  return found(data, "Deal") as Deal;
}
const checklist = (deal: Deal, config: StageConfig) => stepsFor(deal, config).map((s) => ({
  key: `${deal.stage}:${s.step.id}`, label: s.step.label, required: Boolean(s.step.required), done: s.done,
  ...(s.automatic ? { automatic: "ticks itself from the deal's fields" } : {}),
}));

const importRow = z.object({
  first_name: z.string().max(100).optional(), last_name: z.string().max(100).optional(), email: z.string().max(200).optional(),
  phone: z.string().max(40).optional(), title: z.string().max(120).optional(), company: z.string().max(200).optional(),
  source: z.string().max(100).optional(), address: z.string().max(300).optional(), city: z.string().max(100).optional(),
  state: z.string().max(100).optional(), zip: z.string().max(20).optional(), website: z.string().max(300).optional(),
  notes: z.string().max(10000).optional(), tags: z.string().max(500).optional().describe("Comma-separated"),
  details: z.record(z.string(), z.string().max(300)).optional().describe("Any other fields to keep"),
});

confirmable("crm_import_contacts", async (ctx, payload) => {
  const r = await importContactRows(ctx.supabase, payload.rows as ImportRow[], payload.role === "lead" ? "lead" : "contact");
  if (r.error) throw new ToolError(r.error);
  return { data: { imported: r.imported, skipped: r.skipped, message: r.ok } };
});

export function registerCrmTools(server: McpServer, ctx: McpContext, perms: string[]) {
  if (!perms.includes("crm.view")) return;
  const manage = () => { if (!perms.includes("crm.manage")) throw new ToolError("You can see the CRM but not change it."); };
  const base = { prefix: "" };

  // --- Pipeline -------------------------------------------------------------
  defineTool(server, ctx, "crm_pipeline_stages", {
    ...base, domain: "crm", risk: "read", title: "Pipeline stages and checklists",
    description: "The pipeline's stages in order, with each stage's default probability, goal, suggested actions and Next Steps (required steps must be done before a deal moves forward).",
    inputSchema: z.object({}),
  }, async () => {
    const config = await stageConfig(ctx);
    return {
      data: {
        path: PIPELINE_PATH, other: ["closed_lost", "nurture"],
        stages: STAGE_ORDER.map((stage) => {
          const g = resolveStage(stage, config);
          return { stage, label: STAGES[stage].label, probability: STAGES[stage].prob, goal: g.goal, actions: g.actions, steps: g.steps.map(({ id: step, label, required }) => ({ id: step, label, required: Boolean(required) })) };
        }),
      },
    };
  });

  defineTool(server, ctx, "crm_deal_checklist", {
    ...base, domain: "crm", risk: "read", title: "A deal's Next Steps",
    description: "The Next Steps for a deal's current stage, which are done, and which are required before it can move forward. Tick one with crm_deal_step_set.",
    inputSchema: z.object({ deal_id: id("Deal") }),
  }, async ({ deal_id }) => {
    const deal = await loadDeal(ctx, deal_id);
    const config = await stageConfig(ctx);
    return { targetId: deal_id, data: { deal: deal.title, stage: deal.stage, steps: checklist(deal, config), blocking: blockingSteps(deal, config).map((s) => s.label) } };
  });

  defineTool(server, ctx, "crm_deal_step_set", {
    ...base, domain: "crm", risk: "write", title: "Tick a Next Step",
    description: "Marks one of a deal's Next Steps done (or not). key is \"<stage>:<step id>\" from crm_deal_checklist. Steps marked automatic tick themselves from the deal's fields (owner, contact, next step) instead.",
    inputSchema: z.object({ deal_id: id("Deal"), key: z.string().max(80), done: z.boolean().default(true) }),
  }, async ({ deal_id, key, done }) => {
    manage();
    const deal = await loadDeal(ctx, deal_id);
    const [stage, step] = key.split(":");
    if (!STAGE_ORDER.includes(stage as DealStage) || !resolveStage(stage as DealStage, await stageConfig(ctx), deal).steps.some((s) => s.id === step)) {
      throw new ToolError("That step isn't on this deal. Call crm_deal_checklist for the keys.");
    }
    const next = { ...deal.checklist };
    if (done) next[key] = true; else delete next[key];
    const { error } = await ctx.supabase.from("crm_deals").update({ checklist: next }).eq("id", deal_id);
    check(error);
    await adminAudit(ctx.supabase, "crm.deal.step", { type: "crm_deal", id: deal_id }, { step: key, done, via: "mcp" });
    return { targetId: deal_id, data: { deal: deal.title, key, done } };
  });

  defineTool(server, ctx, "crm_deal_move_stage", {
    ...base, domain: "crm", risk: "write", title: "Move a deal to a stage",
    description: "Moves a deal like the dashboard does: probability resets to the stage default and stage automations run. Moving forward along the pipeline is refused while the current stage's required Next Steps are open (it lists them). Closing as won can carry won_summary; lost can carry lost_reason and lost_notes.",
    inputSchema: z.object({
      deal_id: id("Deal"), stage: stageArg,
      won_summary: z.string().max(2000).optional(), lost_reason: z.string().max(500).optional(), lost_notes: z.string().max(2000).optional(),
    }),
  }, async ({ deal_id, stage, ...outcome }) => {
    manage();
    const deal = await loadDeal(ctx, deal_id);
    if (deal.stage === stage) return { targetId: deal_id, data: { deal: deal.title, stage, message: `Already in ${STAGES[stage].label}.` } };
    const from = PIPELINE_PATH.indexOf(deal.stage);
    const forward = stage !== "closed_won" && from >= 0 && PIPELINE_PATH.indexOf(stage) > from;
    if (forward) {
      const config = await stageConfig(ctx);
      const missing = blockingSteps(deal, config);
      if (missing.length) {
        throw new ToolError(`${deal.title} can't leave ${STAGES[deal.stage].label} yet. Still to do: ${missing.map((m) => `${m.label} (${deal.stage}:${m.id})`).join("; ")}. Do them (crm_deal_step_set, or fill in the fields they check) and try again.`);
      }
    }
    const message = result(await moveDealStage(ctx.supabase, deal_id, stage, outcome));
    return { targetId: deal_id, data: { deal: deal.title, from: deal.stage, stage, message } };
  });

  defineTool(server, ctx, "crm_lead_convert", {
    ...base, domain: "crm", risk: "write", title: "Turn leads into deals",
    description: "Adds contacts or leads to the pipeline as new deals (New / Working), linked to the existing person, with their source, owner and notes. Anyone who already has an open deal is skipped. The people become prospects marked in_pipeline.",
    inputSchema: z.object({ contact_ids: z.array(z.uuid()).min(1).max(50) }),
  }, async ({ contact_ids }) => {
    manage();
    const r = await contactsToDeals(ctx.supabase, contact_ids);
    if (r.error) throw new ToolError(r.error);
    return { targetId: r.dealIds?.[0] ?? null, data: { created: r.created, skipped: r.skipped, deal_ids: r.dealIds, message: r.ok } };
  });

  defineTool(server, ctx, "crm_import_contacts", {
    ...base, domain: "crm", risk: "high", previewOnly: true, title: "Import contacts or leads",
    description: "Imports up to 500 people. Clients are matched by company name (missing ones are created); rows whose email or phone is already in the CRM are skipped. Nothing is imported yet: this returns a preview and a confirmation_id for confirm_action.",
    inputSchema: z.object({ rows: z.array(importRow).min(1).max(500), role: z.enum(["contact", "lead"]).default("contact") }),
  }, async ({ rows, role }) => {
    manage();
    const companies = new Set(rows.map((r) => r.company?.trim().toLowerCase()).filter(Boolean)).size;
    return prepare(ctx, "crm_import_contacts", { rows, role }, `Import ${rows.length} ${role === "lead" ? "leads" : "contacts"}${companies ? ` across ${companies} ${companies === 1 ? "company" : "companies"}` : ""}`, {
      count: rows.length, role, first_rows: rows.slice(0, 5),
    });
  });

  // --- Bookings ---------------------------------------------------------------
  const setBookings = (status: "confirmed" | "canceled") => async ({ booking_ids }: { booking_ids: string[] }) => {
    manage();
    const { data, error } = await ctx.supabase.from("bookings").update({ status }).in("id", booking_ids).select("id, title, starts_at");
    check(error);
    if (!data?.length) throw new ToolError("No bookings found that you can change.");
    await adminAudit(ctx.supabase, "bookings.status", { type: "booking", id: data[0].id }, { count: data.length, status, via: "mcp" });
    return { targetId: data[0].id, data: { status, updated: data } };
  };
  defineTool(server, ctx, "bookings_confirm", {
    ...base, domain: "bookings", risk: "write", title: "Confirm bookings",
    description: "Marks bookings confirmed. Nothing is sent to the people booked.",
    inputSchema: z.object({ booking_ids: z.array(z.uuid()).min(1).max(100) }),
  }, setBookings("confirmed"));
  defineTool(server, ctx, "bookings_cancel", {
    ...base, domain: "bookings", risk: "write", title: "Cancel bookings",
    description: "Marks bookings canceled. Nothing is sent to the people booked; tell them yourself if they should know.",
    inputSchema: z.object({ booking_ids: z.array(z.uuid()).min(1).max(100) }),
  }, setBookings("canceled"));

  // --- Plans and documents ------------------------------------------------------
  defineTool(server, ctx, "plans_create", {
    ...base, domain: "plans", risk: "write", title: "Start a plan from a template",
    description: `Creates a plan with a template's groups and tasks, due dates counted from start_date. Templates: ${PLAN_TEMPLATES.map((t) => `${t.id} (${t.name})`).join(", ")}.`,
    inputSchema: z.object({
      name: z.string().trim().min(1).max(160), template: z.enum(PLAN_TEMPLATES.map((t) => t.id) as [string, ...string[]]).default("simple"),
      description: z.string().max(5000).optional(), start_date: z.iso.date().optional(), company_id: z.uuid().optional(), deal_id: z.uuid().optional(),
      owner_id: z.uuid().optional().describe("Also assigned every task"), color: z.enum(["slate", "sky", "violet", "amber", "emerald", "rose"]).optional(),
    }),
  }, async (input) => {
    if (!perms.includes("crm.manage") && !perms.includes("projects.manage")) throw new ToolError("You can see plans but not change them.");
    const r = await createPlanFromTemplate(ctx.supabase, input);
    if (r.error) throw new ToolError(r.error);
    return { targetId: r.id, data: { plan_id: r.id, message: r.ok } };
  });

  defineTool(server, ctx, "plan_get", {
    ...base, domain: "plans", risk: "read", title: "Get a plan with its tasks",
    description: "A plan with its groups (columns) and tasks, in board order.",
    inputSchema: z.object({ plan_id: id("Plan") }),
  }, async ({ plan_id }) => {
    const [plan, groups, tasks] = await Promise.all([
      ctx.supabase.from("plans").select("id, name, description, status, color, start_date, due_date, company_id, deal_id, owner_id").eq("id", plan_id).maybeSingle(),
      ctx.supabase.from("plan_groups").select("id, name, position").eq("plan_id", plan_id).order("position"),
      ctx.supabase.from("plan_tasks").select("id, group_id, title, status, priority, assignee_id, start_date, due_date, is_milestone, labels, position")
        .eq("plan_id", plan_id).order("position").limit(500),
    ]);
    check(plan.error); check(groups.error); check(tasks.error);
    return { targetId: plan_id, data: { plan: found(plan.data, "Plan"), groups: groups.data, tasks: tasks.data } };
  });

  defineTool(server, ctx, "document_link", {
    ...base, domain: "documents", risk: "read", title: "Get a document link",
    description: "A temporary link to a document: one hour to view it, or download_days (1-7) for a download link you can share (sharing links are logged).",
    inputSchema: z.object({ document_id: id("Document"), download_days: z.number().int().min(1).max(7).optional() }),
  }, async ({ document_id, download_days }) => {
    const { data: doc, error } = await ctx.supabase.from("documents").select("path, name").eq("id", document_id).maybeSingle();
    check(error);
    const { path, name } = found(doc, "Document");
    const seconds = download_days ? download_days * 86400 : 3600;
    const link = await ctx.supabase.storage.from("documents").createSignedUrl(path, seconds, download_days ? { download: name } : undefined);
    if (link.error) throw new ToolError("That file couldn't be found in storage.");
    if (download_days) await adminAudit(ctx.supabase, "documents.share", { type: "document", id: document_id }, { days: download_days, via: "mcp" });
    return { targetId: document_id, data: { name, url: link.data.signedUrl, expires_at: new Date(Date.now() + seconds * 1000).toISOString() } };
  });
}
