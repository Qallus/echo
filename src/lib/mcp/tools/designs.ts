import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { check, found, id } from "./shared";
import { BLOCK_IDS, DEFAULT_DESIGN, MERGE_FIELDS, normalizeDesign } from "@/lib/designs/schema";
import { siteUrl } from "@/lib/notify/senders";

// Summary designs (the Summary Builder) for Claude: list, read, and create or
// update a design from plain instructions ("navy header, our logo, footer with
// our address"). Every config goes through normalizeDesign before it's stored.

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Hex color like #0a0a0a");
const configSchema = z.object({
  logo: z.object({ url: z.url().nullable().optional().describe("Public https URL of the logo image"), height: z.number().int().min(16).max(120).optional(), align: z.enum(["left", "center", "right"]).optional() }).optional(),
  header: z.object({ title: z.string().max(200).optional(), subtitle: z.string().max(300).optional(), background: hex.optional(), textColor: hex.optional() }).optional(),
  page: z.object({ background: hex.optional(), content: hex.optional(), text: hex.optional(), accent: hex.optional(), font: z.enum(["sans", "serif"]).optional() }).optional(),
  footer: z.object({ background: hex.optional(), textColor: hex.optional(), text: z.string().max(1000).optional(), links: z.string().max(500).optional(), poweredBy: z.boolean().optional() }).optional(),
  blocks: z.array(z.object({ id: z.enum(BLOCK_IDS as [string, ...string[]]), enabled: z.boolean() })).optional()
    .describe(`Order and visibility of summary blocks: ${BLOCK_IDS.join(", ")}`),
}).describe(`Only include what changes. Text fields accept merge fields: ${MERGE_FIELDS.map((f) => f.token).join(", ")}.`);

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

export function registerDesignTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "design_list", {
    title: "List summary designs",
    description: "Summary designs (logo, colors, header, footer) you own or that are shared with your Business workspace.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const { data, error } = await ctx.supabase.from("summary_designs").select("id, name, is_default, workspace_id, user_id, updated_at").order("updated_at", { ascending: false });
    check(error);
    return { data: { designs: (data ?? []).map((d) => ({ ...d, mine: d.user_id === ctx.user.id, edit_url: siteUrl(`/templates/designs/${d.id}`) })) } };
  });

  defineTool(server, ctx, "design_get", {
    title: "Get summary design",
    description: "One design's full config.",
    inputSchema: z.object({ design_id: id("Design") }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ design_id }) => {
    const { data, error } = await ctx.supabase.from("summary_designs").select("id, name, config, is_default, workspace_id").eq("id", design_id).maybeSingle();
    check(error);
    const d = found(data, "Design");
    return { targetId: d.id, data: { design: { ...d, config: normalizeDesign(d.config) } } };
  });

  defineTool(server, ctx, "design_upsert", {
    title: "Create or update summary design",
    description: "Build a summary design for the user: logo, header text and colors, page colors, footer colors and content, and which blocks show. Pass design_id to update (only the fields you pass change); omit it to create one from Echo's defaults. Ask the user for their logo URL, brand colors and footer details if you don't have them.",
    inputSchema: z.object({
      design_id: id("Design").optional(),
      name: z.string().trim().min(1).max(100).optional(),
      config: configSchema.default({}),
      make_default: z.boolean().optional().describe("Use this design for the user's branded summaries by default"),
    }),
    annotations: WRITE,
  }, async ({ design_id, name, config, make_default }) => {
    let base = DEFAULT_DESIGN;
    if (design_id) {
      const { data, error } = await ctx.supabase.from("summary_designs").select("config, user_id").eq("id", design_id).maybeSingle();
      check(error);
      base = normalizeDesign(found(data, "Design").config);
    }
    const merged = normalizeDesign({
      ...base, ...config,
      logo: { ...base.logo, ...config.logo }, header: { ...base.header, ...config.header },
      page: { ...base.page, ...config.page }, footer: { ...base.footer, ...config.footer },
      blocks: config.blocks ?? base.blocks,
    }, base);
    if (make_default) check((await ctx.supabase.from("summary_designs").update({ is_default: false }).eq("user_id", ctx.user.id).eq("is_default", true)).error);
    const row = { config: merged, ...(name ? { name } : {}), ...(make_default ? { is_default: true } : {}) };
    const res = design_id
      ? await ctx.supabase.from("summary_designs").update(row).eq("id", design_id).select("id, name").single()
      : await ctx.supabase.from("summary_designs").insert({ ...row, name: name ?? "Summary design", user_id: ctx.user.id }).select("id, name").single();
    check(res.error);
    return { targetId: res.data!.id, data: { design: res.data, config: merged, edit_url: siteUrl(`/templates/designs/${res.data!.id}`) } };
  });
}
