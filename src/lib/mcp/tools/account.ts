import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { DEFAULT_PREFS, NOTIFICATION_TYPES, type NotificationType } from "@/lib/notify/types";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { resolveWorkspace, workspaceArg } from "../workspace";
import { check, id } from "./shared";

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

export function registerAccountTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "whoami", {
    title: "Who am I",
    description: "The signed-in Echo user, the workspace tools act in by default (Personal), your role there, and the connected app.",
    inputSchema: z.object({ workspace_id: workspaceArg }),
    annotations: READ,
  }, async ({ workspace_id }) => {
    const ws = await resolveWorkspace(ctx, workspace_id);
    return {
      workspaceId: ws.id,
      data: { user: { id: ctx.user.id, email: ctx.user.email }, workspace: ws, client_id: ctx.user.clientId || null },
    };
  });

  defineTool(server, ctx, "workspace_list", {
    title: "List workspaces",
    description: "Your workspaces: Personal (only you) and any Business workspaces (shared with the team), with your role in each.",
    inputSchema: z.object({}),
    annotations: READ,
  }, async () => {
    const { data, error } = await ctx.supabase
      .from("workspace_members").select("role, workspaces!inner(id, name, is_personal)").eq("user_id", ctx.user.id);
    check(error);
    const workspaces = (data ?? []).map((m) => {
      const w = m.workspaces as unknown as { id: string; name: string; is_personal: boolean };
      return { id: w.id, name: w.name, kind: w.is_personal ? "personal" : "business", role: m.role };
    });
    return { data: { workspaces } };
  });

  defineTool(server, ctx, "workspace_update", {
    title: "Rename workspace",
    description: "Rename a Business workspace (owner or admin only).",
    inputSchema: z.object({ workspace_id: id("Workspace"), name: z.string().trim().min(1).max(120) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ workspace_id, name }) => {
    const { data, error } = await ctx.supabase.from("workspaces").update({ name }).eq("id", workspace_id).select("id, name");
    check(error);
    if (!data?.length) throw new ToolError("Workspace not found, or only owners and admins can rename it.");
    return { workspaceId: workspace_id, targetId: workspace_id, data: { workspace: data[0] } };
  });

  defineTool(server, ctx, "member_list", {
    title: "List members",
    description: "People in a workspace with their roles and emails. Defaults to your Personal workspace.",
    inputSchema: z.object({ workspace_id: workspaceArg }),
    annotations: READ,
  }, async ({ workspace_id }) => {
    const ws = await resolveWorkspace(ctx, workspace_id);
    const { data, error } = await ctx.supabase.rpc("list_workspace_members", { ws: ws.id });
    check(error);
    return { workspaceId: ws.id, data: { workspace: { id: ws.id, name: ws.name }, members: data } };
  });

  // Your own profile and notification settings (Settings in the dashboard).
  const acct = { prefix: "", domain: "account" };
  defineTool(server, ctx, "account_profile_get", {
    ...acct, risk: "read", title: "Get my profile",
    description: "Your profile: name, photo URL, job title, company, time zone, location, bio, website, LinkedIn and quiet hours (texts and push wait; email and the bell still arrive).",
    inputSchema: z.object({}),
  }, async () => {
    const { data, error } = await ctx.supabase.from("profiles")
      .select("id, full_name, avatar_url, job_title, company, phone_visible, timezone, location, bio, website, linkedin, quiet_start, quiet_end, updated_at")
      .eq("id", ctx.user.id).maybeSingle();
    check(error);
    return { data: { profile: data } };
  });

  defineTool(server, ctx, "account_profile_update", {
    ...acct, risk: "write", title: "Update my profile",
    description: "Change your own profile; only pass what changes. avatar_url must be an https link (upload a photo in Settings instead if you have a file). quiet_start / quiet_end are HH:MM, or null for no quiet hours.",
    inputSchema: z.object({
      full_name: z.string().trim().min(1).max(120).optional(), avatar_url: z.url().startsWith("https://").max(500).nullable().optional(),
      job_title: z.string().trim().max(120).nullable().optional(), company: z.string().trim().max(160).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(), phone_visible: z.boolean().optional(), timezone: z.string().trim().max(60).optional(),
      location: z.string().trim().max(120).nullable().optional(), bio: z.string().trim().max(1000).nullable().optional(),
      website: z.url().max(300).nullable().optional(), linkedin: z.url().max(300).nullable().optional(),
      quiet_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), quiet_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    }),
  }, async (input) => {
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (!Object.keys(patch).length) throw new ToolError("Pass at least one field to change.");
    if (typeof patch.timezone === "string") {
      try { new Intl.DateTimeFormat("en-US", { timeZone: patch.timezone }); } catch { throw new ToolError("Use a time zone like America/Phoenix."); }
    }
    const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", ctx.user.id);
    check(error);
    return { targetId: ctx.user.id, data: { updated: Object.keys(patch) } };
  });

  defineTool(server, ctx, "notification_settings_get", {
    ...acct, risk: "read", title: "Get my notification settings",
    description: "For each kind of notification, whether it reaches you in the app (the bell), by email, by text and by push. Kinds you never changed use the defaults (app and email on, text and push off).",
    inputSchema: z.object({}),
  }, async () => {
    const { data, error } = await ctx.supabase.from("notification_preferences").select("type, in_app, email, sms, push").eq("user_id", ctx.user.id);
    check(error);
    const saved = new Map((data ?? []).map((r) => [r.type, r]));
    return {
      data: {
        settings: NOTIFICATION_TYPES.map((t) => ({ type: t.type, label: t.label, ...(saved.get(t.type) ?? { ...DEFAULT_PREFS }), ...(saved.has(t.type) ? {} : { default: true }) })),
      },
    };
  });

  defineTool(server, ctx, "notification_settings_set", {
    ...acct, risk: "write", title: "Change a notification setting",
    description: "Turn one kind of notification on or off per channel (in_app, email, sms, push); only pass what changes. type comes from notification_settings_get. Texts and push need a verified phone or device in Settings.",
    inputSchema: z.object({
      type: z.enum(NOTIFICATION_TYPES.map((t) => t.type) as [NotificationType, ...NotificationType[]]),
      in_app: z.boolean().optional(), email: z.boolean().optional(), sms: z.boolean().optional(), push: z.boolean().optional(),
    }),
  }, async ({ type, ...channels }) => {
    const { data: current } = await ctx.supabase.from("notification_preferences").select("in_app, email, sms, push").eq("user_id", ctx.user.id).eq("type", type).maybeSingle();
    const next = { ...DEFAULT_PREFS, ...(current ?? {}), ...Object.fromEntries(Object.entries(channels).filter(([, v]) => v !== undefined)) };
    const { error } = await ctx.supabase.from("notification_preferences").upsert({ user_id: ctx.user.id, type, ...next }, { onConflict: "user_id,type" });
    check(error);
    return { data: { type, ...next } };
  });
}
