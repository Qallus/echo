import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { RESOURCES, canRead, canWrite, describe, resource, type Resource } from "../registry";
import { resolveWorkspace } from "../workspace";
import { check, cursorArg, cursorFilter, decodeCursor, found, id, limitArg, nextCursor } from "./shared";

// Generic CRUD over the resources in registry.ts. Plain names (no echo_
// prefix): resource_types, resource_list, resource_get, resource_create,
// resource_update, resource_delete (needs confirm_action).

const nameArg = z.string().max(60).describe("Resource name from resource_types, e.g. contact, company, deal, calendar_event");

function pick(name: string, perms: string[]): Resource {
  const r = resource(name);
  if (!r || !canRead(r, perms)) throw new ToolError(`There's no resource called "${name}" you can use. Call resource_types to see them.`);
  return r;
}
function writable(r: Resource, perms: string[]) {
  if (!canWrite(r, perms)) throw new ToolError(`You can read ${r.title.toLowerCase()} but not change them.`);
}
function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  const i = res.error.issues[0];
  throw new ToolError(`${i?.path.length ? `${i.path.join(".")}: ` : ""}${i?.message ?? "Those values aren't allowed."}`);
}

// Deleting runs only after confirm_action.
confirmable("resource_delete", async (ctx, payload) => {
  const r = resource(String(payload.resource));
  if (!r) throw new ToolError("That resource no longer exists.");
  const { error, count } = await ctx.supabase.from(r.table).delete({ count: "exact" }).eq("id", String(payload.id));
  check(error);
  if (!count) throw new ToolError(`That ${r.name} was already deleted or you don't have access.`);
  return { targetId: String(payload.id), data: { deleted: { resource: r.name, id: payload.id, label: payload.label } } };
});

export function registerResourceTools(server: McpServer, ctx: McpContext, perms: string[]) {
  const mine = () => RESOURCES.filter((r) => canRead(r, perms));
  if (!mine().length) return;
  const base = { prefix: "", domain: "resource" };

  defineTool(server, ctx, "resource_types", {
    ...base, risk: "read", title: "List resource types",
    description: "The kinds of records you can list, create, update and delete with the resource_* tools, with their fields, filters and which fields are required. Call this first.",
    inputSchema: z.object({}),
  }, async () => ({ data: { resources: mine().map((r) => ({ ...describe(r), can_change: canWrite(r, perms) })) } }));

  defineTool(server, ctx, "resource_list", {
    ...base, risk: "read", title: "List records",
    description: "List records of one resource, newest first. q searches the resource's search fields; filters matches exact values (see resource_types). Page with cursor.",
    inputSchema: z.object({
      resource: nameArg, q: z.string().trim().max(100).optional().describe("Search text"),
      filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe("Exact matches, e.g. {\"role\": \"lead\"}"),
      limit: limitArg, cursor: cursorArg,
    }),
  }, async ({ resource: name, q, filters, limit, cursor }) => {
    const r = pick(name, perms);
    let query = ctx.supabase.from(r.table).select(r.select);
    if (filters && Object.keys(filters).length) {
      const allowed = z.object(r.filters ?? {}).partial().strict();
      for (const [k, v] of Object.entries(parse(allowed, filters))) query = query.eq(k, v as string);
    }
    const term = q?.replace(/[,()*%\\]/g, " ").trim();
    if (term && r.search?.length) query = query.or(r.search.map((c) => `${c}.ilike.*${term}*`).join(","));
    const c = decodeCursor(cursor);
    if (c) query = query.or(cursorFilter(c));
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    check(error);
    const rows = (data ?? []) as unknown as { id: string; created_at: string }[];
    return { data: { resource: r.name, rows, next_cursor: nextCursor(rows, limit) } };
  });

  defineTool(server, ctx, "resource_get", {
    ...base, risk: "read", title: "Get a record",
    description: "One record by id.",
    inputSchema: z.object({ resource: nameArg, id: id("Record") }),
  }, async ({ resource: name, id: rowId }) => {
    const r = pick(name, perms);
    const { data, error } = await ctx.supabase.from(r.table).select(r.select).eq("id", rowId).maybeSingle();
    check(error);
    return { targetId: rowId, data: { resource: r.name, row: found(data, r.title.replace(/s( and .*)?$/, "")) } };
  });

  defineTool(server, ctx, "resource_create", {
    ...base, risk: "write", title: "Create a record",
    description: "Create a record. data must match the resource's fields (resource_types). Workspace resources go in your personal workspace unless you pass workspace_id; ask before using a Business workspace.",
    inputSchema: z.object({ resource: nameArg, data: z.record(z.string(), z.unknown()), workspace_id: z.uuid().optional() }),
  }, async ({ resource: name, data, workspace_id }) => {
    const r = pick(name, perms);
    writable(r, perms);
    const row: Record<string, unknown> = parse(r.fields.strict(), data);
    let ws: string | undefined;
    if (r.workspaceScoped) row.workspace_id = ws = (await resolveWorkspace(ctx, workspace_id)).id;
    const { data: created, error } = await ctx.supabase.from(r.table).insert(row).select(r.select).single();
    check(error);
    const out = created as unknown as Record<string, unknown>;
    return { targetId: String(out.id), workspaceId: ws, data: { resource: r.name, created: out } };
  });

  defineTool(server, ctx, "resource_update", {
    ...base, risk: "write", title: "Update a record",
    description: "Change some fields of a record. Only pass the fields to change.",
    inputSchema: z.object({ resource: nameArg, id: id("Record"), data: z.record(z.string(), z.unknown()) }),
  }, async ({ resource: name, id: rowId, data }) => {
    const r = pick(name, perms);
    writable(r, perms);
    const patch = parse(r.fields.partial().strict(), data);
    if (!Object.keys(patch).length) throw new ToolError("Pass at least one field to change.");
    const { data: updated, error } = await ctx.supabase.from(r.table).update(patch).eq("id", rowId).select(r.select).maybeSingle();
    check(error);
    return { targetId: rowId, data: { resource: r.name, updated: found(updated, "Record") } };
  });

  defineTool(server, ctx, "resource_delete", {
    ...base, risk: "high", title: "Delete a record",
    description: "Permanently delete a record. Nothing is deleted yet: this returns a preview and a confirmation_id. Show the person, and only after a clear yes call confirm_action.",
    inputSchema: z.object({ resource: nameArg, id: id("Record") }),
  }, async ({ resource: name, id: rowId }) => {
    const r = pick(name, perms);
    writable(r, perms);
    const { data, error } = await ctx.supabase.from(r.table).select(r.select).eq("id", rowId).maybeSingle();
    check(error);
    const row = found(data, "Record") as unknown as Record<string, unknown>;
    const label = r.label(row);
    const out = await prepare(ctx, "resource_delete", { resource: r.name, id: rowId, label }, `Permanently delete the ${r.name.replace("_", " ")} "${label}"`, row);
    return { ...out, targetId: rowId };
  });
}
