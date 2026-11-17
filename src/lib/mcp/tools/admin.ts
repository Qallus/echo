import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { adminAudit } from "@/lib/admin/audit";
import { encryptKey, last4 } from "@/lib/ai/keys";
import { SERVICES, fieldFor } from "@/lib/integrations";
import { invalidateSecrets } from "@/lib/secrets";
import { readOrg } from "@/lib/settings/organization";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { check, id } from "./shared";

// Super Admin over MCP: users, staff, the audit log, platform settings and
// integration keys. Only through the same staff-checked database functions
// the dashboard uses (each re-checks the permission; most write the audit
// log themselves), as the caller. Never the service role: account bans and
// invitations (Supabase admin API) stay in the dashboard. Changes to people,
// access, settings and secrets need confirm_action. Secrets are write-only:
// a confirmation stores only the encrypted value, and nothing returns one.

const STAFF_ROLES = ["owner", "admin", "support", "finance", "marketing", "analyst"] as const;
// Settings keys this tool may change, each validated like its dashboard form.
const SETTING_KEYS = ["organization"] as const;

confirmable("admin_user_suspend", async (ctx, p) => {
  const { error } = await ctx.supabase.rpc("admin_suspend_user", { p_user: String(p.user_id), p_reason: String(p.reason ?? "").slice(0, 500) || null });
  if (error) throw new ToolError(error.message);
  return {
    targetId: String(p.user_id),
    data: { suspended: p.user_id, note: "Their data is locked and they're signed out. To also block signing in, click Suspend on their page in Admin -> Users (that step needs the dashboard)." },
  };
});

confirmable("admin_user_restore", async (ctx, p) => {
  const { error } = await ctx.supabase.rpc("admin_restore_user", { p_user: String(p.user_id) });
  if (error) throw new ToolError(error.message);
  return { targetId: String(p.user_id), data: { restored: p.user_id, note: "If sign-in was blocked in the dashboard, click Restore on their page in Admin -> Users too." } };
});

confirmable("admin_user_sign_out", async (ctx, p) => {
  const { error } = await ctx.supabase.rpc("admin_sign_out_user", { p_user: String(p.user_id) });
  if (error) throw new ToolError(error.message);
  return { targetId: String(p.user_id), data: { signed_out: p.user_id } };
});

confirmable("admin_staff_set_role", async (ctx, p) => {
  const { data, error } = await ctx.supabase.rpc("admin_set_staff_role", { p_email: String(p.email), p_role: String(p.role) });
  if (error) throw new ToolError(error.message);
  return { targetId: String(data ?? p.email), data: { email: p.email, role: p.role } };
});

confirmable("admin_setting_set", async (ctx, p) => {
  const key = String(p.key);
  const { error } = await ctx.supabase.from("platform_settings").upsert({ key, value: p.value }, { onConflict: "key" });
  if (error) throw new ToolError(error.message);
  await adminAudit(ctx.supabase, `settings.${key}.save`, { type: "setting", id: key }, { via: "mcp" });
  return { targetId: key, data: { saved: key } };
});

// The payload already holds the encrypted value (never the plain one).
confirmable("admin_integration_set", async (ctx, p) => {
  const key = String(p.key);
  const { error } = await ctx.supabase.rpc("admin_save_secret", { p_key: key, p_ciphertext: String(p.ciphertext), p_hint: String(p.hint) });
  if (error) throw new ToolError(error.message);
  await adminAudit(ctx.supabase, "integrations.save", { type: "integration", id: String(p.service) }, { keys: [key], via: "mcp" });
  invalidateSecrets();
  return { targetId: key, data: { saved: key, in_use: "within a minute" } };
});

export function registerAdminTools(server: McpServer, ctx: McpContext, perms: string[]) {
  const base = { prefix: "", domain: "admin" };
  const has = (p: string) => perms.includes(p);

  if (has("users.view")) {
    defineTool(server, ctx, "admin_user_list", {
      ...base, risk: "read", title: "List users",
      description: "Echo / Redial accounts: email, name, account type, sign-up and last sign-in, workspaces, recordings, staff role, suspended, subscription status. q searches email and name.",
      inputSchema: z.object({ q: z.string().trim().max(100).optional(), suspended: z.boolean().optional(), limit: z.number().int().min(1).max(200).default(50) }),
    }, async ({ q, suspended, limit }) => {
      const { data, error } = await ctx.supabase.rpc("admin_list_users");
      check(error);
      const term = q?.toLowerCase();
      const rows = ((data ?? []) as { email: string | null; full_name: string | null; suspended: boolean }[])
        .filter((u) => (!term || `${u.email ?? ""} ${u.full_name ?? ""}`.toLowerCase().includes(term)) && (suspended === undefined || u.suspended === suspended));
      return { data: { users: rows.slice(0, limit), total: rows.length } };
    });

    defineTool(server, ctx, "admin_user_get", {
      ...base, risk: "read", title: "Get a user",
      description: "One account in detail: profile, workspaces, usage this month, subscriptions and suspension.",
      inputSchema: z.object({ user_id: id("User") }),
    }, async ({ user_id }) => {
      const { data, error } = await ctx.supabase.rpc("admin_user_detail", { p_user: user_id });
      check(error);
      if (!data) throw new ToolError("User not found.");
      return { targetId: user_id, data: { user: data } };
    });
  }

  if (has("users.manage")) {
    const userAction = (name: string, title: string, description: string, action: string, verb: string) =>
      defineTool(server, ctx, name, {
        ...base, risk: "high", previewOnly: true, title, description: `${description} Returns a preview and confirmation_id; run with confirm_action after a clear yes.`,
        inputSchema: z.object({ user_id: id("User"), reason: z.string().trim().max(500).optional() }),
      }, async ({ user_id, reason }) => {
        const { data, error } = await ctx.supabase.rpc("admin_user_detail", { p_user: user_id });
        check(error);
        const u = data as { email?: string; profile?: { email?: string } } | null;
        if (!u) throw new ToolError("User not found.");
        const who = u.email ?? u.profile?.email ?? user_id;
        return prepare(ctx, action, { user_id, reason: reason ?? "" }, `${verb} ${who}`, { user: who, reason });
      });
    userAction("admin_user_suspend", "Suspend a user", "Lock an account: their workspace data is blocked at once and every session ends.", "admin_user_suspend", "Suspend");
    userAction("admin_user_restore", "Restore a suspended user", "Unlock a suspended account.", "admin_user_restore", "Restore");
    userAction("admin_user_sign_out", "Sign a user out everywhere", "End every session the account has on every device.", "admin_user_sign_out", "Sign out everywhere:");
  }

  if (has("staff.manage")) {
    defineTool(server, ctx, "admin_staff_list", {
      ...base, risk: "read", title: "List staff",
      description: "Super Admin staff with their role and whether two-step sign-in is set up. AI agent accounts are listed by agent_list instead.",
      inputSchema: z.object({}),
    }, async () => {
      const { data, error } = await ctx.supabase.rpc("admin_list_staff");
      check(error);
      return { data: { staff: data ?? [] } };
    });

    defineTool(server, ctx, "admin_staff_set_role", {
      ...base, risk: "high", previewOnly: true, title: "Give someone a staff role",
      description: "Add someone (by the email of their existing account) to Super Admin staff, or change their role: owner, admin, support, finance, marketing or analyst. Returns a preview and confirmation_id; run with confirm_action after a clear yes.",
      inputSchema: z.object({ email: z.email(), role: z.enum(STAFF_ROLES) }),
    }, async ({ email, role }) => prepare(ctx, "admin_staff_set_role", { email: email.toLowerCase(), role }, `Make ${email} a staff ${role}`, { email, role }));
  }

  if (has("audit.view")) {
    defineTool(server, ctx, "admin_audit_feed", {
      ...base, risk: "read", title: "Admin audit log",
      description: "Every Super Admin change, newest first: who, what, the target and details (changes made through this connector are marked via mcp).",
      inputSchema: z.object({ limit: z.number().int().min(1).max(1000).default(100), action: z.string().max(80).optional().describe("Only actions starting with this, e.g. billing. or user.") }),
    }, async ({ limit, action }) => {
      const { data, error } = await ctx.supabase.rpc("admin_audit_feed", { max_rows: action ? 1000 : limit });
      check(error);
      const rows = ((data ?? []) as { action: string }[]).filter((r) => !action || r.action.startsWith(action)).slice(0, limit);
      return { data: { entries: rows } };
    });
  }

  if (has("settings.manage") || has("audit.view")) {
    defineTool(server, ctx, "admin_settings_get", {
      ...base, risk: "read", title: "Get platform settings",
      description: "Platform settings by key: organization (company details on receipts and legal pages), billing, ai, transcription, crm_stages, booking_availability, admin_security, live_agents. Omit key for the list of keys that are set.",
      inputSchema: z.object({ key: z.string().regex(/^[a-z_]{2,40}$/).optional() }),
    }, async ({ key }) => {
      if (!key) {
        const { data, error } = await ctx.supabase.from("platform_settings").select("key, updated_at").order("key");
        check(error);
        return { data: { keys: data ?? [] } };
      }
      const { data, error } = await ctx.supabase.from("platform_settings").select("key, value, updated_at").eq("key", key).maybeSingle();
      check(error);
      return { data: { setting: data ?? { key, value: null } } };
    });
  }

  if (has("settings.manage")) {
    defineTool(server, ctx, "admin_settings_set", {
      ...base, risk: "high", previewOnly: true, title: "Change platform settings",
      description: "Change the organization details (name, legalName, email, phone, address, website, timezone); only pass what changes. Billing settings use billing_settings_set; other settings stay in the dashboard. Returns a preview and confirmation_id; run with confirm_action after a clear yes.",
      inputSchema: z.object({
        key: z.enum(SETTING_KEYS), name: z.string().trim().max(120).optional(), legalName: z.string().trim().max(160).optional(), email: z.string().trim().max(200).optional(),
        phone: z.string().trim().max(40).optional(), address: z.string().trim().max(300).optional(), website: z.string().trim().max(200).optional(), timezone: z.string().trim().max(60).optional(),
      }),
    }, async ({ key, ...changes }) => {
      const { data } = await ctx.supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
      const value = readOrg({ ...readOrg(data?.value), ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) });
      if (!value.name) throw new ToolError("The company name can't be empty.");
      if (value.email && !/^\S+@\S+\.\S+$/.test(value.email)) throw new ToolError("Enter a valid email address.");
      try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }); } catch { throw new ToolError("Choose a valid time zone, e.g. America/Phoenix."); }
      return prepare(ctx, "admin_setting_set", { key, value }, `Change the ${key} settings`, { from: readOrg(data?.value), to: value });
    });

    defineTool(server, ctx, "admin_integrations_list", {
      ...base, risk: "read", title: "List integration settings",
      description: "Each service in Admin -> Settings -> Integrations and its fields: which are set in the dashboard (with a masked hint for secret ones), never the values. Unset fields fall back to Coolify.",
      inputSchema: z.object({}),
    }, async () => {
      const { data, error } = await ctx.supabase.from("platform_secrets").select("key, hint, updated_at");
      check(error);
      const saved = new Map(((data ?? []) as { key: string; hint: string | null; updated_at: string }[]).map((r) => [r.key, r]));
      return {
        data: {
          services: SERVICES.map((s) => ({
            id: s.id, name: s.name,
            fields: s.fields.map((f) => ({ key: f.key, label: f.label, secret: Boolean(f.secret), required: Boolean(f.required), set_here: saved.has(f.key), hint: saved.get(f.key)?.hint ?? null, updated_at: saved.get(f.key)?.updated_at ?? null })),
          })),
        },
      };
    });

    defineTool(server, ctx, "admin_integration_set", {
      ...base, risk: "high", previewOnly: true, title: "Set an integration key",
      description: "Save one integration value (an API key, ID, number or URL) by its key from admin_integrations_list. It's encrypted at once; the preview and the confirmation never contain it, and nothing can read it back. Only use a value the person gave you for this. Run with confirm_action after a clear yes.",
      inputSchema: z.object({ key: z.string().regex(/^[A-Z0-9_]{2,60}$/), value: z.string().trim().min(1).max(4000) }),
    }, async ({ key, value }) => {
      const field = fieldFor(key);
      if (!field) throw new ToolError("Unknown key. See admin_integrations_list.");
      const service = SERVICES.find((s) => s.fields.some((f) => f.key === key))!;
      const hint = field.secret ? `••••${last4(value)}` : value.slice(0, 200);
      return prepare(ctx, "admin_integration_set", { key, service: service.id, ciphertext: encryptKey(value), hint },
        `Save ${service.name}: ${field.label} (${hint})`, { service: service.name, field: field.label, shown_as: hint });
    });
  }
}
