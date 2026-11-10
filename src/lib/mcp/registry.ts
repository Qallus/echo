import "server-only";
import { z } from "zod";
import type { Permission } from "@/lib/admin/permissions";
import { queueAutomations } from "@/lib/comms/automations";
import { STAGES, isStage } from "@/lib/crm/deals";
import { textToDoc } from "@/lib/workspace/text";
import type { McpContext } from "./auth";
import { ToolError } from "./audit";

// The automation MCP's resources: each table is declared once here, and the
// generic resource_* tools (tools/resources.ts) list, read, create, update and
// delete it. Everything still runs as the caller, so RLS decides what they
// can reach; `access` only hides resources a caller can't use and gives a
// clear refusal before the database does. Deletes always need a confirm.
// Changes to staff resources also go to the admin audit log as `audit`.
//
// To add a resource: its table, the columns to return, the writable fields
// (matching the table's column grants and checks), and any filters. Moves
// that have rules (deal stages, imports) are action tools, not fields here.

type Row = Record<string, unknown>;
export type Resource = {
  name: string;
  domain: string;
  title: string;
  description: string;
  table: string;
  // Staff permission to read / change it (any of a list). Omitted: the caller's own data.
  access: { read?: Permission; write?: Permission | Permission[] };
  audit?: string;
  select: string;
  // Lighter columns for resource_list (big text stays on resource_get).
  listSelect?: string;
  fields: z.ZodObject;
  // Fields resource_update may change (default: all of them).
  updatable?: string[];
  create?: false;
  search?: string[];
  filters?: Record<string, z.ZodType>;
  // Rows belong to a workspace: create puts them in the given (or personal) one.
  workspaceScoped?: boolean;
  // Fill in or translate values before a write (may throw a ToolError).
  prepare?: (ctx: McpContext, row: Row, op: "create" | "update", id?: string) => Promise<Row>;
  afterCreate?: (ctx: McpContext, row: Row) => Promise<void>;
  afterDelete?: (ctx: McpContext, row: Row) => Promise<void>;
  label: (row: Row) => string;
};

const s = (max: number) => z.string().trim().max(max);
const tags = z.array(s(40)).max(20);
const date = z.iso.date();
const datetime = z.iso.datetime({ offset: true });
const slug = (max: number) => z.string().regex(new RegExp(`^[a-z0-9][a-z0-9-]{0,${max - 1}}$`), "Use lowercase letters, numbers and dashes");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "A color like #18181b");
const PLAN_WRITERS: Permission[] = ["crm.manage", "projects.manage"];
const DEAL_STAGES = ["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation", "closed_won", "closed_lost", "nurture"] as const;
const name = (r: Row) => [r.first_name, r.last_name].filter(Boolean).join(" ") || String(r.name ?? r.email ?? r.id);
const when = (r: Row, key = "starts_at") => (r[key] ? ` (${String(r[key]).slice(0, 16).replace("T", " ")})` : "");

// The CRM contact with this email, when one isn't given.
async function contactByEmail(ctx: McpContext, row: Row) {
  if (row.contact_id || typeof row.email !== "string" || !row.email) return row;
  const { data } = await ctx.supabase.from("crm_contacts").select("id").eq("email", row.email.toLowerCase()).limit(1).maybeSingle();
  return data ? { ...row, contact_id: data.id } : row;
}

export const RESOURCES: Resource[] = [
  // -------------------------------------------------------------------------
  // CRM
  // -------------------------------------------------------------------------
  {
    name: "contact", domain: "crm", title: "Contacts and leads", audit: "crm.contact",
    description: "People in the CRM. role says what they are (lead, prospect, client...); lead_status tracks working a lead. Leads are contacts with role lead. Turn one into a deal with crm_lead_convert.",
    table: "crm_contacts", access: { read: "crm.view", write: "crm.manage" },
    select: "id, first_name, last_name, email, phone, title, company_id, role, status, lead_status, source, interest, website, address, city, state, zip, tags, notes, owner_id, created_at, updated_at",
    fields: z.object({
      first_name: s(100).min(1), last_name: s(100).optional(), email: z.email().max(200).optional(), phone: s(40).optional(), title: s(120).optional(),
      company_id: z.uuid().optional(), role: z.enum(["contact", "lead", "prospect", "client", "partner"]).optional(),
      status: z.enum(["active", "inactive", "archived"]).optional(),
      lead_status: z.enum(["new", "attempting", "contacted", "nurture", "qualified", "disqualified", "in_pipeline"]).optional(),
      source: s(100).optional(), interest: s(200).optional(), website: s(300).optional(), address: s(300).optional(),
      city: s(100).optional(), state: s(100).optional(), zip: s(20).optional(), tags: tags.optional(), notes: s(10000).optional(), owner_id: z.uuid().optional(),
    }),
    search: ["first_name", "last_name", "email", "phone"],
    filters: {
      role: z.enum(["contact", "lead", "prospect", "client", "partner"]), status: z.enum(["active", "inactive", "archived"]),
      lead_status: z.string(), company_id: z.uuid(), owner_id: z.uuid(), source: z.string(),
    },
    prepare: async (_ctx, row, op) => ({
      ...row, ...(typeof row.email === "string" ? { email: row.email.toLowerCase() } : {}),
      ...(op === "create" && row.role === "lead" && !row.lead_status ? { lead_status: "new" } : {}),
    }),
    afterCreate: async (ctx, row) => { if (row.role === "lead") await queueAutomations(ctx.supabase, "lead_created", [{ contactId: String(row.id) }]); },
    label: name,
  },
  {
    name: "company", domain: "crm", title: "Companies and clients", audit: "crm.client",
    description: "Organizations in the CRM (Admin -> Clients). status: prospect, client, partner or former.",
    table: "crm_companies", access: { read: "crm.view", write: "crm.manage" },
    select: "id, name, status, website, industry, phone, email, address, tags, notes, owner_id, created_at, updated_at",
    fields: z.object({
      name: s(200).min(1), status: z.enum(["prospect", "client", "partner", "former"]).optional(), website: s(300).optional(),
      industry: s(100).optional(), phone: s(40).optional(), email: z.email().max(200).optional(), address: s(400).optional(),
      tags: tags.optional(), notes: s(10000).optional(), owner_id: z.uuid().optional(),
    }),
    search: ["name", "email", "website"],
    filters: { status: z.enum(["prospect", "client", "partner", "former"]), industry: z.string(), owner_id: z.uuid() },
    label: (r) => String(r.name ?? r.id),
  },
  {
    name: "deal", domain: "crm", title: "Pipeline deals", audit: "crm.deal",
    description: "Opportunities in the pipeline. stage can be set when creating; to move a deal later use crm_deal_move_stage, which follows the stage checklist (see crm_pipeline_stages). value_cents is in cents.",
    table: "crm_deals", access: { read: "crm.view", write: "crm.manage" },
    select: "id, title, stage, value_cents, currency, probability, company_id, contact_id, expected_close, next_step, next_step_type, next_step_due, next_step_priority, source, products, owner_id, checklist, closed_at, notes, created_at, updated_at",
    fields: z.object({
      title: s(200).min(1), stage: z.enum(DEAL_STAGES).optional(),
      value_cents: z.number().int().min(0).max(100_000_000_000).optional(), currency: z.string().regex(/^[a-z]{3}$/).optional(),
      probability: z.number().int().min(0).max(100).optional(), company_id: z.uuid().optional(), contact_id: z.uuid().optional(),
      expected_close: date.optional(), next_step: s(300).optional(),
      next_step_type: z.enum(["call", "email", "sms", "meeting", "demo", "proposal", "follow_up", "contract", "other"]).optional(),
      next_step_due: date.optional(), next_step_priority: z.enum(["low", "normal", "high"]).optional(), source: s(100).optional(),
      products: z.array(s(80)).max(30).optional(), lost_reason: s(500).optional(), notes: s(10000).optional(), owner_id: z.uuid().optional(),
    }),
    updatable: [
      "title", "value_cents", "currency", "probability", "company_id", "contact_id", "expected_close", "next_step", "next_step_type",
      "next_step_due", "next_step_priority", "source", "products", "lost_reason", "notes", "owner_id",
    ],
    search: ["title"],
    filters: { stage: z.enum(DEAL_STAGES), company_id: z.uuid(), contact_id: z.uuid(), owner_id: z.uuid() },
    prepare: async (_ctx, row, op) => {
      if (op !== "create") return row;
      const stage = isStage(row.stage) ? row.stage : "new_working";
      return { ...row, stage, probability: row.probability ?? STAGES[stage].prob };
    },
    afterCreate: async (ctx, row) => { await queueAutomations(ctx.supabase, "added_to_pipeline", [{ dealId: String(row.id) }]); },
    label: (r) => String(r.title ?? r.id),
  },
  {
    name: "activity", domain: "crm", title: "Activities, notes and tasks", audit: "crm.activity",
    description: "The timeline on contacts, companies and deals: notes, tasks (due_at, done_at) and calls, emails, texts or meetings that happened outside Echo. Attach each to at least one of contact_id, company_id or deal_id. After creating, only body, due_at and done_at can change (done_at null reopens a task).",
    table: "crm_activities", access: { read: "crm.view", write: "crm.manage" },
    select: "id, kind, subject, body, direction, status, due_at, done_at, occurred_at, duration_seconds, ai_summary, company_id, contact_id, deal_id, created_by, created_at",
    fields: z.object({
      kind: z.enum(["note", "call", "email", "sms", "meeting", "task", "voicemail"]), body: s(100000), subject: s(300).optional(),
      direction: z.enum(["inbound", "outbound"]).optional(), due_at: datetime.nullable().optional(), done_at: datetime.nullable().optional(),
      occurred_at: datetime.optional(), duration_seconds: z.number().int().min(0).max(86400).optional(),
      company_id: z.uuid().optional(), contact_id: z.uuid().optional(), deal_id: z.uuid().optional(),
    }),
    updatable: ["body", "due_at", "done_at"],
    search: ["subject", "body"],
    filters: { kind: z.enum(["note", "call", "email", "sms", "meeting", "task", "voicemail"]), company_id: z.uuid(), contact_id: z.uuid(), deal_id: z.uuid() },
    prepare: async (_ctx, row, op) => {
      if (op === "create" && !row.company_id && !row.contact_id && !row.deal_id) throw new ToolError("Attach the activity to a contact_id, company_id or deal_id.");
      return row;
    },
    label: (r) => `${r.kind}: ${String(r.subject || r.body || r.id).slice(0, 60)}`,
  },

  // -------------------------------------------------------------------------
  // Bookings and events
  // -------------------------------------------------------------------------
  {
    name: "booking_type", domain: "bookings", title: "Booking types", audit: "bookings.type",
    description: "The meetings people can book on the website (length, location, notice, how far ahead).",
    table: "booking_types", access: { read: "crm.view", write: "crm.manage" },
    select: "id, name, slug, description, minutes, location, location_detail, buffer_minutes, min_notice_hours, max_days_ahead, host_id, color, active, sort, created_at, updated_at",
    fields: z.object({
      name: s(120).min(1), slug: slug(60), description: s(1000).optional(), minutes: z.number().int().min(5).max(480).optional(),
      location: z.enum(["phone", "video", "in_person"]).optional(), location_detail: s(300).optional(),
      buffer_minutes: z.number().int().min(0).max(240).optional(), min_notice_hours: z.number().int().min(0).max(720).optional(),
      max_days_ahead: z.number().int().min(1).max(365).optional(), host_id: z.uuid().optional(), color: s(20).optional(),
      active: z.boolean().optional(), sort: z.number().int().min(0).max(1000).optional(),
    }),
    search: ["name", "slug"],
    filters: { active: z.boolean(), host_id: z.uuid() },
    label: (r) => String(r.name ?? r.id),
  },
  {
    name: "booking", domain: "bookings", title: "Bookings", audit: "bookings",
    description: "Meetings booked with people. starts_at and ends_at are ISO times with an offset. The CRM contact is linked by email when contact_id isn't given, and new bookings go on the contact's timeline. Confirm or cancel with bookings_confirm / bookings_cancel.",
    table: "bookings", access: { read: "crm.view", write: "crm.manage" },
    select: "id, type_id, title, starts_at, ends_at, status, name, email, phone, company, notes, location, source, host_id, contact_id, company_id, deal_id, created_at, updated_at",
    fields: z.object({
      title: s(200).min(1), starts_at: datetime, ends_at: datetime, name: s(200).min(1), type_id: z.uuid().optional(),
      status: z.enum(["pending", "confirmed", "completed", "canceled", "no_show"]).optional(), email: z.email().max(200).optional(),
      phone: s(40).optional(), company: s(200).optional(), notes: s(5000).optional(), location: s(300).optional(), host_id: z.uuid().optional(),
      contact_id: z.uuid().optional(), company_id: z.uuid().optional(), deal_id: z.uuid().optional(),
    }),
    search: ["name", "email", "title", "company"],
    filters: { status: z.enum(["pending", "confirmed", "completed", "canceled", "no_show"]), type_id: z.uuid(), host_id: z.uuid(), contact_id: z.uuid(), deal_id: z.uuid() },
    prepare: (ctx, row) => contactByEmail(ctx, row),
    afterCreate: async (ctx, row) => {
      if (!row.contact_id && !row.deal_id && !row.company_id) return;
      await ctx.supabase.from("crm_activities").insert({
        kind: "meeting", subject: row.title, body: row.notes ?? "", contact_id: row.contact_id, deal_id: row.deal_id, company_id: row.company_id, due_at: row.starts_at,
      });
    },
    label: (r) => `${r.title ?? r.id}${when(r)}`,
  },
  {
    name: "event", domain: "bookings", title: "Events", audit: "events",
    description: "Public events people register for (Admin -> Bookings -> Events). status draft, published or canceled.",
    table: "events", access: { read: "crm.view", write: "crm.manage" },
    select: "id, title, slug, summary, description, location_kind, location, online_url, starts_at, ends_at, all_day, capacity, status, registration_open, host_id, created_at, updated_at",
    listSelect: "id, title, slug, summary, location_kind, location, starts_at, ends_at, capacity, status, registration_open, created_at",
    fields: z.object({
      title: s(200).min(1), slug: slug(80), starts_at: datetime, ends_at: datetime, summary: s(500).optional(), description: s(20000).optional(),
      location_kind: z.enum(["in_person", "online", "hybrid"]).optional(), location: s(300).optional(), online_url: z.url().max(500).optional(),
      all_day: z.boolean().optional(), capacity: z.number().int().min(1).max(100000).nullable().optional(),
      status: z.enum(["draft", "published", "canceled"]).optional(), registration_open: z.boolean().optional(), host_id: z.uuid().optional(),
    }),
    search: ["title", "slug", "location"],
    filters: { status: z.enum(["draft", "published", "canceled"]), location_kind: z.enum(["in_person", "online", "hybrid"]) },
    label: (r) => `${r.title ?? r.id}${when(r)}`,
  },
  {
    name: "event_registration", domain: "bookings", title: "Event registrations", audit: "events.registration",
    description: "People registered for an event. Linked to the CRM contact by email. status registered, canceled, attended or no_show.",
    table: "event_registrations", access: { read: "crm.view", write: "crm.manage" },
    select: "id, event_id, name, email, phone, company, guests, status, contact_id, created_at",
    fields: z.object({
      event_id: z.uuid(), name: s(200).min(1), email: z.email().max(200), phone: s(40).optional(), company: s(200).optional(),
      guests: z.number().int().min(1).max(20).optional(), status: z.enum(["registered", "canceled", "attended", "no_show"]).optional(), contact_id: z.uuid().optional(),
    }),
    updatable: ["name", "email", "phone", "company", "guests", "status", "contact_id"],
    search: ["name", "email", "company"],
    filters: { event_id: z.uuid(), status: z.enum(["registered", "canceled", "attended", "no_show"]) },
    prepare: (ctx, row) => contactByEmail(ctx, row),
    label: (r) => `${r.name ?? r.id} (${r.email ?? ""})`,
  },

  // -------------------------------------------------------------------------
  // Plans, workspace and documents
  // -------------------------------------------------------------------------
  {
    name: "plan", domain: "plans", title: "Plans", audit: "plans",
    description: "Project plans with task boards. To start one from a template (with its groups and tasks) use plans_create; plan_get shows a plan with its groups and tasks.",
    table: "plans", access: { read: "crm.view", write: PLAN_WRITERS },
    select: "id, name, description, color, status, default_view, company_id, deal_id, owner_id, start_date, due_date, created_at, updated_at",
    fields: z.object({
      name: s(160).min(1), description: s(5000).optional(), color: z.enum(["slate", "sky", "violet", "amber", "emerald", "rose"]).optional(),
      status: z.enum(["active", "archived"]).optional(), default_view: z.enum(["board", "list", "grid", "calendar"]).optional(),
      company_id: z.uuid().nullable().optional(), deal_id: z.uuid().nullable().optional(), owner_id: z.uuid().nullable().optional(),
      start_date: date.nullable().optional(), due_date: date.nullable().optional(),
    }),
    search: ["name"],
    filters: { status: z.enum(["active", "archived"]), company_id: z.uuid(), deal_id: z.uuid(), owner_id: z.uuid() },
    label: (r) => String(r.name ?? r.id),
  },
  {
    name: "plan_task", domain: "plans", title: "Plan tasks", audit: "plans.task",
    description: "Tasks on a plan. group_id is one of the plan's groups (plan_get lists them). checklist is a list of {id, title, done}.",
    table: "plan_tasks", access: { read: "crm.view", write: PLAN_WRITERS },
    select: "id, plan_id, group_id, title, notes, status, priority, assignee_id, start_date, due_date, position, is_milestone, labels, checklist, completed_at, created_at, updated_at",
    fields: z.object({
      plan_id: z.uuid(), title: s(300).min(1), group_id: z.uuid().nullable().optional(), notes: s(20000).optional(),
      status: z.enum(["not_started", "in_progress", "waiting", "blocked", "complete"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(), assignee_id: z.uuid().nullable().optional(),
      start_date: date.nullable().optional(), due_date: date.nullable().optional(), position: z.number().int().min(0).max(100000).optional(),
      is_milestone: z.boolean().optional(), labels: z.array(s(40)).max(10).optional(),
      checklist: z.array(z.object({ id: s(40).min(1), title: s(300).min(1), done: z.boolean() })).max(50).optional(),
    }),
    updatable: ["title", "group_id", "notes", "status", "priority", "assignee_id", "start_date", "due_date", "position", "is_milestone", "labels", "checklist"],
    search: ["title"],
    filters: {
      plan_id: z.uuid(), group_id: z.uuid(), assignee_id: z.uuid(),
      status: z.enum(["not_started", "in_progress", "waiting", "blocked", "complete"]), priority: z.enum(["low", "medium", "high", "urgent"]),
    },
    label: (r) => String(r.title ?? r.id),
  },
  {
    name: "workspace_doc", domain: "workspace", title: "Workspace docs", audit: "workspace.doc",
    description: "The team's pages in Admin -> Workspace. Write the page with body: plain text with # headings, - bullets, 1. numbered items and - [ ] tasks (it replaces the whole page). Private docs are only visible to their author.",
    table: "workspace_docs", access: { read: "crm.view", write: "crm.view" },
    select: "id, title, icon, content_text, parent_id, visibility, pinned, company_id, deal_id, created_by, updated_by, created_at, updated_at",
    listSelect: "id, title, icon, parent_id, visibility, pinned, company_id, deal_id, created_by, created_at, updated_at",
    fields: z.object({
      title: s(200).min(1), body: z.string().max(200000).optional(), icon: s(8).optional(), parent_id: z.uuid().nullable().optional(),
      visibility: z.enum(["team", "private"]).optional(), pinned: z.boolean().optional(),
      company_id: z.uuid().nullable().optional(), deal_id: z.uuid().nullable().optional(),
    }),
    search: ["title", "content_text"],
    filters: { parent_id: z.uuid(), visibility: z.enum(["team", "private"]), pinned: z.boolean(), company_id: z.uuid(), deal_id: z.uuid() },
    prepare: async (_ctx, { body, ...row }) => (typeof body === "string" ? { ...row, content: textToDoc(body), content_text: body } : row),
    label: (r) => String(r.title ?? r.id),
  },
  {
    name: "workspace_comment", domain: "workspace", title: "Workspace comments", audit: "workspace.comment",
    description: "Comments on a workspace doc. quote is the text being commented on. Only resolved can change afterwards.",
    table: "workspace_comments", access: { read: "crm.view", write: "crm.view" },
    select: "id, doc_id, body, quote, resolved, created_by, created_at",
    fields: z.object({ doc_id: z.uuid(), body: s(5000).min(1), quote: s(500).optional(), resolved: z.boolean().optional() }),
    updatable: ["resolved"],
    filters: { doc_id: z.uuid(), resolved: z.boolean() },
    // New comments always start open.
    prepare: async (_ctx, row, op) => { if (op === "create") delete row.resolved; return row; },
    label: (r) => String(r.body ?? r.id).slice(0, 60),
  },
  {
    name: "doc_folder", domain: "documents", title: "Document folders", audit: "documents.folder",
    description: "Folders in Admin -> Documents. parent_id nests a folder inside another.",
    table: "doc_folders", access: { read: "crm.view", write: PLAN_WRITERS },
    select: "id, name, parent_id, created_by, created_at",
    fields: z.object({ name: s(120).min(1), parent_id: z.uuid().nullable().optional() }),
    search: ["name"],
    filters: { parent_id: z.uuid() },
    label: (r) => String(r.name ?? r.id),
  },
  {
    name: "document", domain: "documents", title: "Documents", audit: "documents",
    description: "Files in Admin -> Documents. Uploads happen in the dashboard; here you can rename, move, tag, link and delete them. Get a download link with document_link.",
    table: "documents", access: { read: "crm.view", write: PLAN_WRITERS }, create: false,
    select: "id, name, folder_id, size, mime, tags, notes, company_id, contact_id, deal_id, plan_id, path, uploaded_by, created_at, updated_at",
    fields: z.object({
      name: s(255).min(1), folder_id: z.uuid().nullable().optional(), tags: tags.optional(), notes: s(5000).optional(),
      company_id: z.uuid().nullable().optional(), contact_id: z.uuid().nullable().optional(), deal_id: z.uuid().nullable().optional(), plan_id: z.uuid().nullable().optional(),
    }),
    search: ["name", "notes"],
    filters: { folder_id: z.uuid(), company_id: z.uuid(), contact_id: z.uuid(), deal_id: z.uuid(), plan_id: z.uuid() },
    afterDelete: async (ctx, row) => { if (typeof row.path === "string") await ctx.supabase.storage.from("documents").remove([row.path]); },
    label: (r) => String(r.name ?? r.id),
  },

  // -------------------------------------------------------------------------
  // Business cards, waitlist, reports
  // -------------------------------------------------------------------------
  {
    name: "business_card", domain: "cards", title: "Business cards", audit: "cards",
    description: "Digital business cards (Admin -> Cards). Staff manage their own cards; crm.manage manages everyone's. Links and the visual design are edited in the dashboard. Publishing (status published) makes the card public at its slug.",
    table: "business_cards", access: { read: "crm.view", write: "crm.view" },
    select: "id, slug, card_name, status, full_name, first_name, last_name, title, company, department, bio, email, phone, sms_phone, website, address, accent, theme, lead_capture, nfc_status, owner_id, published_at, created_at, updated_at",
    fields: z.object({
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "Use 2-60 lowercase letters, numbers and dashes"), full_name: s(120).min(1),
      card_name: s(120).optional(), status: z.enum(["draft", "published", "unpublished", "archived"]).optional(),
      first_name: s(60).optional(), last_name: s(60).optional(), title: s(120).optional(), company: s(120).optional(), department: s(120).optional(),
      bio: s(1000).optional(), email: z.email().max(200).optional(), phone: s(40).optional(), sms_phone: s(40).optional(), website: z.url().max(300).optional(),
      address: s(300).optional(), accent: hex.optional(), theme: z.enum(["light", "dark", "both"]).optional(), owner_id: z.uuid().optional(),
    }),
    search: ["full_name", "card_name", "slug", "company"],
    filters: { status: z.enum(["draft", "published", "unpublished", "archived"]), owner_id: z.uuid() },
    prepare: async (ctx, row, op, id) => {
      const out: Row = op === "create" ? { owner_id: ctx.user.id, card_name: row.full_name, ...row } : { ...row };
      if (row.status === "published") {
        const prior = id ? (await ctx.supabase.from("business_cards").select("published_at").eq("id", id).maybeSingle()).data?.published_at : null;
        if (!prior) out.published_at = new Date().toISOString();
      }
      return out;
    },
    label: (r) => `${r.card_name ?? r.full_name ?? r.id} (/${r.slug ?? ""})`,
  },
  {
    name: "card_lead", domain: "cards", title: "Business card leads", audit: "cards.lead",
    description: "People who left their details on a business card. Only status can change (new, contacted, qualified, archived).",
    table: "card_leads", access: { read: "crm.view", write: "crm.view" }, create: false,
    select: "id, card_id, name, email, phone, company, message, status, contact_id, created_at",
    fields: z.object({ status: z.enum(["new", "contacted", "qualified", "archived"]) }),
    search: ["name", "email", "company"],
    filters: { card_id: z.uuid(), status: z.enum(["new", "contacted", "qualified", "archived"]) },
    label: (r) => `${r.name ?? r.id} (${r.email ?? r.phone ?? ""})`,
  },
  {
    name: "waitlist_entry", domain: "waitlist", title: "App waitlist", audit: "waitlist",
    description: "People waiting for the Redial app. status: waiting, notified, invited, joined, unsubscribed. sms_frequency and update_topics are the person's own choices: change them only when they asked. waitlist_export gives counts and a CSV.",
    table: "app_waitlist", access: { read: "comms.view", write: "comms.manage" }, create: false,
    select: "id, first_name, last_name, email, phone, platforms, products, account_type, company, team_size, use_case, details, questions, consent_email, consent_sms, consent_call, consent_at, sms_frequency, update_topics, status, source_page, contact_id, created_at, updated_at",
    listSelect: "id, first_name, last_name, email, phone, platforms, products, account_type, company, team_size, consent_email, consent_sms, sms_frequency, status, contact_id, created_at",
    fields: z.object({
      status: z.enum(["waiting", "notified", "invited", "joined", "unsubscribed"]), sms_frequency: z.enum(["major", "monthly", "weekly", "all"]),
      update_topics: z.array(z.enum(["launch", "beta", "features", "tips", "offers"])).max(5),
    }).partial(),
    search: ["first_name", "last_name", "email", "phone", "company"],
    filters: { status: z.enum(["waiting", "notified", "invited", "joined", "unsubscribed"]), account_type: z.enum(["personal", "business"]) },
    label: name,
  },
  {
    name: "saved_report", domain: "reports", title: "Saved reports", audit: "reports",
    description: "Reports saved in Admin -> Reports (shared ones are visible to all staff who can see reports). Only their author can change them. Run one with reports_run.",
    table: "saved_reports", access: { read: "analytics.view", write: "analytics.view" },
    select: "id, name, kind, range, since, until, shared, created_by, created_at",
    fields: z.object({
      name: s(120).min(1),
      kind: z.enum(["pipeline_by_stage", "pipeline_by_owner", "win_loss", "lost_reasons", "lead_sources", "revenue", "comms_activity", "usage"]),
      range: z.enum(["7d", "30d", "90d", "12m", "ytd", "custom"]).optional(), since: date.nullable().optional(), until: date.nullable().optional(), shared: z.boolean().optional(),
    }),
    search: ["name"],
    filters: { kind: z.string(), shared: z.boolean() },
    label: (r) => String(r.name ?? r.id),
  },

  // -------------------------------------------------------------------------
  // The caller's own data
  // -------------------------------------------------------------------------
  {
    name: "calendar_event", domain: "calendar", title: "Calendar events",
    description: "Appointments, events and deadlines on the caller's calendar (in a workspace).",
    table: "calendar_events", access: {}, workspaceScoped: true,
    select: "id, workspace_id, kind, title, starts_at, ends_at, all_day, location, notes, attendees, recording_id, created_by, created_at, updated_at",
    fields: z.object({
      title: s(200).min(1), kind: z.enum(["appointment", "event", "deadline"]).optional(), starts_at: datetime, ends_at: datetime,
      all_day: z.boolean().optional(), location: s(300).optional(), notes: s(5000).optional(),
      attendees: z.array(z.object({ name: s(120).optional(), email: s(200).optional() })).max(50).optional(),
    }),
    search: ["title", "location"],
    filters: { kind: z.enum(["appointment", "event", "deadline"]), workspace_id: z.uuid() },
    label: (r) => `${r.title ?? r.id}${when(r)}`,
  },
];

export const resource = (name: string) => RESOURCES.find((r) => r.name === name) ?? null;

export const canRead = (r: Resource, perms: string[]) => !r.access.read || perms.includes(r.access.read);
export const canWrite = (r: Resource, perms: string[]) => {
  const w = r.access.write;
  return !w || (Array.isArray(w) ? w.some((p) => perms.includes(p)) : perms.includes(w));
};
// The fields resource_update accepts.
export const updateFields = (r: Resource) =>
  (r.updatable ? r.fields.pick(Object.fromEntries(r.updatable.map((k) => [k, true])) as Record<string, true> & Record<number, never>) : r.fields).partial();

// What a resource looks like, for resource_types.
export function describe(r: Resource) {
  const schema = z.toJSONSchema(r.fields) as { properties?: Record<string, unknown>; required?: string[] };
  return {
    resource: r.name, domain: r.domain, title: r.title, description: r.description,
    fields: schema.properties, required: r.create === false ? [] : schema.required ?? [],
    can_create: r.create !== false, updatable: r.updatable ?? Object.keys(schema.properties ?? {}),
    filters: Object.keys(r.filters ?? {}), search: r.search ?? [], workspace_scoped: Boolean(r.workspaceScoped),
    delete: "needs confirm (permanent)",
  };
}
