import "server-only";
import { z } from "zod";
import type { Permission } from "@/lib/admin/permissions";

// The automation MCP's resources: each table is declared once here, and the
// generic resource_* tools (tools/resources.ts) list, read, create, update and
// delete it. Everything still runs as the caller, so RLS decides what they
// can reach; `access` only hides resources a caller can't use and gives a
// clear refusal before the database does. Deletes always need a confirm.
//
// To add a resource: its table, the columns to return, the writable fields
// (matching the table's column grants and checks), and any filters.

export type Resource = {
  name: string;
  domain: string;
  title: string;
  description: string;
  table: string;
  // Staff permission to read / change it. Omitted: the caller's own data.
  access: { read?: Permission; write?: Permission };
  select: string;
  fields: z.ZodObject;
  search?: string[];
  filters?: Record<string, z.ZodType>;
  // Rows belong to a workspace: create puts them in the given (or personal) one.
  workspaceScoped?: boolean;
  label: (row: Record<string, unknown>) => string;
};

const s = (max: number) => z.string().trim().max(max);
const tags = z.array(s(40)).max(20);
const date = z.iso.date();
const datetime = z.iso.datetime({ offset: true });

export const RESOURCES: Resource[] = [
  {
    name: "contact", domain: "crm", title: "Contacts and leads",
    description: "People in the CRM. role says what they are (lead, prospect, client...); lead_status tracks working a lead.",
    table: "crm_contacts", access: { read: "crm.view", write: "crm.manage" },
    select: "id, first_name, last_name, email, phone, title, company_id, role, status, lead_status, source, interest, website, address, city, state, zip, tags, notes, owner_id, created_at, updated_at",
    fields: z.object({
      first_name: s(100).min(1), last_name: s(100).optional(), email: s(200).optional(), phone: s(40).optional(), title: s(120).optional(),
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
    label: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || String(r.email ?? r.id),
  },
  {
    name: "company", domain: "crm", title: "Companies and clients",
    description: "Organizations in the CRM. status: prospect, client, partner or former.",
    table: "crm_companies", access: { read: "crm.view", write: "crm.manage" },
    select: "id, name, status, website, industry, phone, email, address, tags, notes, owner_id, created_at, updated_at",
    fields: z.object({
      name: s(200).min(1), status: z.enum(["prospect", "client", "partner", "former"]).optional(), website: s(300).optional(),
      industry: s(100).optional(), phone: s(40).optional(), email: s(200).optional(), address: s(400).optional(),
      tags: tags.optional(), notes: s(10000).optional(), owner_id: z.uuid().optional(),
    }),
    search: ["name", "email", "website"],
    filters: { status: z.enum(["prospect", "client", "partner", "former"]), industry: z.string(), owner_id: z.uuid() },
    label: (r) => String(r.name ?? r.id),
  },
  {
    name: "deal", domain: "crm", title: "Pipeline deals",
    description: "Opportunities in the pipeline. Moving stage here skips the stage checklist; prefer the dashboard for stage moves until crm_deal_move_stage exists. value_cents is in cents.",
    table: "crm_deals", access: { read: "crm.view", write: "crm.manage" },
    select: "id, title, stage, value_cents, currency, probability, company_id, contact_id, expected_close, next_step, next_step_type, next_step_due, next_step_priority, source, products, owner_id, closed_at, notes, created_at, updated_at",
    fields: z.object({
      title: s(200).min(1),
      stage: z.enum(["new_working", "contacted", "qualified", "opportunity", "proposal", "negotiation", "closed_won", "closed_lost", "nurture"]).optional(),
      value_cents: z.number().int().min(0).max(100_000_000_000).optional(), currency: z.string().regex(/^[a-z]{3}$/).optional(),
      probability: z.number().int().min(0).max(100).optional(), company_id: z.uuid().optional(), contact_id: z.uuid().optional(),
      expected_close: date.optional(), next_step: s(300).optional(),
      next_step_type: z.enum(["call", "email", "sms", "meeting", "demo", "proposal", "follow_up", "contract", "other"]).optional(),
      next_step_due: date.optional(), next_step_priority: z.enum(["low", "normal", "high"]).optional(), source: s(100).optional(),
      products: z.array(s(80)).max(30).optional(), lost_reason: s(500).optional(), notes: s(10000).optional(), owner_id: z.uuid().optional(),
    }),
    search: ["title"],
    filters: { stage: z.string(), company_id: z.uuid(), contact_id: z.uuid(), owner_id: z.uuid() },
    label: (r) => String(r.title ?? r.id),
  },
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
    label: (r) => `${r.title ?? r.id}${r.starts_at ? ` (${String(r.starts_at).slice(0, 16).replace("T", " ")})` : ""}`,
  },
];

export const resource = (name: string) => RESOURCES.find((r) => r.name === name) ?? null;

export const canRead = (r: Resource, perms: string[]) => !r.access.read || perms.includes(r.access.read);
export const canWrite = (r: Resource, perms: string[]) => !r.access.write || perms.includes(r.access.write);

// What a resource looks like, for resource_types.
export function describe(r: Resource) {
  const schema = z.toJSONSchema(r.fields) as { properties?: Record<string, unknown>; required?: string[] };
  return {
    resource: r.name, domain: r.domain, title: r.title, description: r.description,
    fields: schema.properties, required: schema.required ?? [],
    filters: Object.keys(r.filters ?? {}), search: r.search ?? [], workspace_scoped: Boolean(r.workspaceScoped),
    delete: "needs confirm (permanent)",
  };
}
