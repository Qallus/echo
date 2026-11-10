import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  ACCOUNT_TYPES, CONTACT_ROLES, CONTACT_STATUSES, LEAD_STATUSES, PLANS, WAITLIST_PRODUCTS, WAITLIST_STATUSES, WAITLIST_TOPICS, audienceLabel,
} from "@/lib/comms/audience";
import { BLOCKS, BLOCK_ORDER, CATEGORIES, DEFAULT_SETTINGS, MERGE_FIELDS, STATUSES, defaultSchema } from "@/lib/comms/blocks";
import { BULK, CLAUDE_DAILY, deliver, prepareSchedule, previewSend, saveAudienceRow, saveTemplateRow, sendTest, type Content, type Target } from "@/lib/comms/email";
import { checkSendAt } from "@/lib/comms/schedule";
import { AUDIENCE_CAP } from "@/lib/comms/send";
import { loadOrganization, orgMergeValues } from "@/lib/settings/organization";
import type { McpContext } from "../auth";
import { defineTool, ToolError } from "../audit";
import { check, found, id, limitArg } from "./shared";

// Email for Echo staff (Super Admin → Communications → Email), registered
// only for staff with comms.view. Writes need comms.manage, and the database
// checks the same permission on every row (RLS). Claude can write templates
// (drafts by default), test-send to the signed-in person, and send to people
// or an audience only through prepare → the person says yes → confirm.

const READ = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const SEND = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

const contentArg = z.object({
  template_id: z.uuid().optional().describe("Send a saved template (it must be Active). Its subject is used unless you pass subject."),
  subject: z.string().max(300).optional().describe("Subject line. Merge fields like {{first_name}} work."),
  body_text: z.string().max(50000).optional().describe("A plain message, without a template. Paragraphs separated by blank lines."),
  html: z.string().max(200000).optional().describe("One-off HTML instead of a template. An Unsubscribe footer is added if it has no {{unsubscribe_url}} link."),
}).describe("What to send: template_id, or subject plus body_text or html.");

const audienceArg = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("contacts"), roles: z.array(z.enum(CONTACT_ROLES)).optional(), statuses: z.array(z.enum(CONTACT_STATUSES)).optional(),
    leadStatuses: z.array(z.enum(LEAD_STATUSES)).optional(), tags: z.array(z.string().max(40)).max(20).optional(), tagMode: z.enum(["any", "all"]).optional(),
    ownerIds: z.array(z.uuid()).max(50).optional(),
  }),
  z.object({ source: z.literal("waitlist"), products: z.array(z.enum(WAITLIST_PRODUCTS)).optional(), topics: z.array(z.enum(WAITLIST_TOPICS)).optional(), statuses: z.array(z.enum(WAITLIST_STATUSES)).optional() }),
  z.object({ source: z.literal("customers"), accountTypes: z.array(z.enum(ACCOUNT_TYPES)).optional(), plans: z.array(z.enum(PLANS)).optional() }),
]).describe("A bulk audience. Empty lists mean any. contacts excludes archived unless statuses says otherwise; waitlist only includes people who agreed to email.");

const targetArg = z.object({
  contact_ids: z.array(z.uuid()).max(500).optional().describe("CRM contact ids"),
  emails: z.array(z.email()).max(500).optional().describe("Email addresses"),
  audience: audienceArg.optional(),
  audience_id: z.uuid().optional().describe("A saved audience (see echo_email_audience_list)"),
  deal_id: z.uuid().optional().describe("Tie the email to a deal: its fields merge and it logs on the deal"),
}).describe("Who gets it: people, an audience, or both.");

const toContent = (c: z.infer<typeof contentArg>): Content => ({ templateId: c.template_id, subject: c.subject, body: c.body_text, html: c.html });
const toTarget = (t: z.infer<typeof targetArg>): Target => ({ contactIds: t.contact_ids, emails: t.emails, audience: t.audience, audienceId: t.audience_id, dealId: t.deal_id });
const ok = <T>(r: T | { error: string }): T => { if (r && typeof r === "object" && "error" in r && r.error) throw new ToolError(r.error); return r as T; };

export function registerEmailTools(server: McpServer, ctx: McpContext, permissions: string[]) {
  const canManage = permissions.includes("comms.manage");
  const manage = () => { if (!canManage) throw new ToolError("Your staff role can read email but not change or send it."); };
  const me = { id: ctx.user.id, email: ctx.user.email };

  defineTool(server, ctx, "email_guide", {
    title: "Email guide and brand",
    description: "Call this before writing an email template. Returns the block types and their fields, an example template, merge fields, categories, the company's brand details (name, address, colors), audience options, and the sending rules.",
    inputSchema: z.object({}),
    annotations: READ,
  }, async () => {
    const org = orgMergeValues(await loadOrganization(ctx.supabase));
    return {
      data: {
        blocks: BLOCK_ORDER.map((t) => ({ type: t, ...BLOCKS[t] })),
        block_fields: "Every block: id (any unique string), type, align (left|center|right), padTop, padBottom, padX. header: url (logo: '/email/logos/echo-light.png' or '/email/logos/redial-light.png' on a dark backgroundColor like #18181b, '/email/logos/echo-dark.png' or '/email/logos/redial-dark.png' on a light one like #ffffff, or any https image), alt, height (default 28), title (text beside or instead of a logo), backgroundColor. heading: text, fontSize, textColor. text: text (plain text, newlines kept), fontSize, textColor. button: text, linkUrl (https), buttonColor, buttonTextColor. image: url (https), alt, width, linkUrl. columns: columns [{ blocks: [text block] }] (2 or 3). divider: dividerColor. spacer: height. footer: text (an Unsubscribe link is always added). buttons: text + linkUrl (main), label + secondaryUrl (outline, optional), buttonColor, buttonTextColor. card: url (https image, optional), alt, title, text, label (button, optional), linkUrl, borderColor. list: items [{ label }], ordered (true for numbers), fontSize, textColor. quote: text, title (name), label (role), url (https photo, optional), borderColor. callout: title, text, backgroundColor, borderColor, textColor. badge: text, backgroundColor, textColor. stats: items [{ label, value }] (up to 4). details: title, items [{ label, value }], borderColor. faq: items [{ label: question, value: answer }]. social: items [{ label: network name, url }]. video: url (https thumbnail, optional), linkUrl (the video), text (caption). code: text (the code), title (above), label (below, e.g. expiry). signature: title (name), label (role), text (contact lines), url (https photo). Colors are hex like #18181b.",
        settings: { defaults: DEFAULT_SETTINGS, fields: "width (px), backgroundColor (page), contentColor (card), textColor, fontFamily" },
        example: defaultSchema(),
        html_mode: "Or write the whole email as HTML (mode: html): tables and inline styles, 600px wide, no scripts. Include {{unsubscribe_url}} in a link, or a footer with one is added.",
        merge_fields: [...MERGE_FIELDS.map((m) => m.token), "{{unsubscribe_url}}"],
        categories: CATEGORIES, statuses: STATUSES,
        brand: { ...org, colors: { ink: "#18181b", muted: "#71717a", page: DEFAULT_SETTINGS.backgroundColor, card: "#ffffff", line: "#e4e4e7" }, site: "https://echo.redial.si" },
        audiences: {
          contacts: { roles: CONTACT_ROLES, statuses: CONTACT_STATUSES, leadStatuses: LEAD_STATUSES, tags: "free text, see echo_email_audience_list" },
          waitlist: { products: WAITLIST_PRODUCTS, topics: WAITLIST_TOPICS, statuses: WAITLIST_STATUSES },
          customers: { accountTypes: ACCOUNT_TYPES, plans: PLANS },
        },
        rules: [
          "Write only what the person asked for. Don't invent customers, testimonials, quotes, prices, dates or offers.",
          "New templates are drafts. Only Active templates can be sent; ask before making one Active.",
          `A send to an audience or more than ${BULK} people needs a test of the same email to the person first (echo_email_send_test, within 24 hours).`,
          "Sending is two steps: echo_email_send_prepare shows who gets it and returns a confirmation_id; show that to the person, and only after they say yes call echo_email_send_confirm.",
          `At most ${AUDIENCE_CAP.toLocaleString()} people per send, and ${CLAUDE_DAILY.toLocaleString()} a day through Claude. Unsubscribed people are always skipped.`,
        ],
      },
    };
  });

  defineTool(server, ctx, "email_template_list", {
    title: "List email templates",
    description: "Email templates, most recently changed first. Archived ones only if you ask for status archived.",
    inputSchema: z.object({
      status: z.enum(STATUSES).optional(), category: z.string().max(40).optional(), query: z.string().max(100).optional().describe("Search name and subject"), limit: limitArg,
    }),
    annotations: READ,
  }, async (a) => {
    let q = ctx.supabase.from("email_templates").select("id, name, subject, category, status, mode, revision, created_via, sends, last_sent_at, updated_at");
    q = a.status ? q.eq("status", a.status) : q.neq("status", "archived");
    if (a.category) q = q.eq("category", a.category);
    if (a.query) q = q.or(`name.ilike.%${a.query.replace(/[%_,()]/g, " ")}%,subject.ilike.%${a.query.replace(/[%_,()]/g, " ")}%`);
    const { data, error } = await q.order("updated_at", { ascending: false }).limit(a.limit);
    check(error);
    return { data: { templates: data } };
  });

  defineTool(server, ctx, "email_template_get", {
    title: "Get email template",
    description: "One template with its blocks (blocks mode) or HTML (html mode). Pass revision back to echo_email_template_save when you change it.",
    inputSchema: z.object({ template_id: id("Template") }),
    annotations: READ,
  }, async ({ template_id }) => {
    const { data, error } = await ctx.supabase.from("email_templates").select("id, name, subject, preheader, category, status, mode, schema, html, revision, sends, updated_at").eq("id", template_id).maybeSingle();
    check(error);
    const t = found(data, "Template");
    const { html, schema, ...rest } = t;
    return { targetId: template_id, data: { ...rest, ...(t.mode === "html" ? { html } : { schema }) } };
  });

  defineTool(server, ctx, "email_template_save", {
    title: "Create or update an email template",
    description: "Create a template (omit template_id) or update one (pass template_id and the revision from echo_email_template_get). Build it from blocks (call echo_email_guide first) or as HTML. New templates are drafts unless you pass status. Never invent customers, testimonials, prices or offers.",
    inputSchema: z.object({
      template_id: z.uuid().optional(),
      revision: z.number().int().optional().describe("The revision you read; the save fails if someone changed it since"),
      name: z.string().min(1).max(120),
      subject: z.string().max(300),
      preheader: z.string().max(300).optional().describe("Preview text shown after the subject in the inbox"),
      category: z.enum(CATEGORIES as [string, ...string[]]).optional(),
      status: z.enum(STATUSES).optional().describe("draft (default for new), active, or archived. Ask the person before making it active."),
      mode: z.enum(["blocks", "html"]).default("blocks"),
      blocks: z.array(z.record(z.string(), z.unknown())).max(80).optional().describe("Blocks mode: the blocks, in order"),
      settings: z.record(z.string(), z.unknown()).optional().describe("Blocks mode: the email style (width, colors, font)"),
      html: z.string().max(200000).optional().describe("HTML mode: the full email HTML"),
    }),
    annotations: WRITE,
  }, async (a) => {
    manage();
    if (a.mode === "html" && !a.html?.trim()) throw new ToolError("Pass html for an HTML template.");
    if (a.mode === "blocks" && !a.blocks?.length) throw new ToolError("Pass blocks for a blocks template (see echo_email_guide).");
    let schema: unknown = a.blocks ? { version: 1, settings: { ...DEFAULT_SETTINGS, ...(a.settings ?? {}) }, blocks: a.blocks.map((b, i) => ({ id: `b${i}_${Date.now().toString(36)}`, ...b })) } : undefined;
    let status = a.status;
    if (a.template_id) {
      const { data: cur } = await ctx.supabase.from("email_templates").select("schema, status").eq("id", a.template_id).maybeSingle();
      found(cur, "Template");
      if (!schema) schema = cur!.schema; // switching to HTML keeps the blocks it had
      status = status ?? (cur!.status as typeof status);
    }
    const res = ok(await saveTemplateRow(ctx.supabase, a.template_id ?? null, {
      name: a.name, subject: a.subject, preheader: a.preheader, category: a.category, status, mode: a.mode, schema, html: a.html, revision: a.revision ?? null,
    }, "claude"));
    return { targetId: res.id, data: { template_id: res.id, revision: res.revision, status: status ?? "draft", next: "Send a test with echo_email_send_test, then show the person." } };
  });

  defineTool(server, ctx, "email_audience_list", {
    title: "List saved audiences",
    description: "Saved email audiences (name and filter), and the tags used on CRM contacts.",
    inputSchema: z.object({}),
    annotations: READ,
  }, async () => {
    const [aud, tags] = await Promise.all([
      ctx.supabase.from("email_audiences").select("id, name, description, definition").order("name"),
      ctx.supabase.from("crm_contacts").select("tags").not("tags", "eq", "{}").limit(2000),
    ]);
    check(aud.error);
    const known = [...new Set((tags.data ?? []).flatMap((r) => r.tags as string[]))].sort();
    return { data: { audiences: (aud.data ?? []).map((x) => ({ ...x, label: audienceLabel(x.definition) })), contact_tags: known } };
  });

  defineTool(server, ctx, "email_audience_save", {
    title: "Save an audience",
    description: "Save a named audience filter to reuse (it's resolved when an email is sent, so it stays current). Pass audience_id to update one.",
    inputSchema: z.object({ audience_id: z.uuid().optional(), name: z.string().min(1).max(80), description: z.string().max(300).optional(), audience: audienceArg }),
    annotations: WRITE,
  }, async (a) => {
    manage();
    const res = ok(await saveAudienceRow(ctx.supabase, a.audience_id ?? null, { name: a.name, description: a.description, definition: a.audience }));
    return { targetId: res.id, data: { audience_id: res.id } };
  });

  defineTool(server, ctx, "email_send_test", {
    title: "Send a test to me",
    description: "Sends one test copy to the signed-in person's own email, with [Test] in the subject, filled in for the first recipient of `to` when given. Needed before a bulk send.",
    inputSchema: z.object({ content: contentArg, to: targetArg.optional().describe("Optional: personalise the test for the first of these recipients") }),
    annotations: SEND,
  }, async (a) => {
    manage();
    const res = ok(await sendTest(ctx.supabase, toContent(a.content), a.to ? toTarget(a.to) : null, me));
    return { targetId: a.content.template_id, data: { result: res.ok } };
  });

  defineTool(server, ctx, "email_send_prepare", {
    title: "Prepare a send (preview)",
    description: "Works out who an email would go to and returns the count, a sample, the filled-in subject, a text excerpt and anything blocking it. Nothing is sent. Pass send_at to schedule it for later instead of sending on confirm. If it can be sent, returns a confirmation_id (valid 15 minutes, once). Show the person the count, subject and time and ask; only after they say yes, call echo_email_send_confirm.",
    inputSchema: z.object({
      content: contentArg, to: targetArg,
      send_at: z.string().max(40).optional().describe("Optional: when to send, as an ISO 8601 date-time with time zone (e.g. 2026-11-10T09:00:00-07:00). Ask the person for their time zone if unclear. Up to 90 days ahead."),
    }),
    annotations: READ,
  }, async (a) => {
    manage();
    const content = toContent(a.content), target = toTarget(a.to);
    const when = a.send_at ? checkSendAt(a.send_at) : null;
    if (when && "error" in when) throw new ToolError(when.error);
    const sendAt = when && "at" in when ? when.at.toISOString() : null;
    const p = ok(await previewSend(ctx.supabase, content, target, me));
    const { html: _html, ...preview } = p;
    void _html;
    if (p.problems.length || !p.sendable) return { data: { preview, can_send: false, next: p.problems[0] ?? "No one would receive it." } };
    const summary = `"${p.firstSubject}" to ${p.sendable} ${p.sendable === 1 ? "person" : "people"} (${p.label})${sendAt ? `, scheduled for ${sendAt}` : ""}`;
    const { data, error } = await ctx.supabase.from("mcp_confirmations").insert({
      client_id: ctx.user.clientId || null, tool: "email_send", payload: { content, target, total: p.total, send_at: sendAt }, summary,
    }).select("id, expires_at").single();
    check(error);
    if (!data) throw new ToolError("Couldn't prepare the send. Try again.");
    return {
      targetId: data.id,
      data: { preview, can_send: true, confirmation_id: data.id, expires_at: data.expires_at, ask: `${sendAt ? "Schedule" : "Send"} ${summary}?`, next: "Ask the person. Only after a clear yes, call echo_email_send_confirm with confirmation_id." },
    };
  });

  defineTool(server, ctx, "email_send_confirm", {
    title: "Send (after the person said yes)",
    description: "Sends the email prepared by echo_email_send_prepare. Only call this after showing the person the preview and getting a clear yes. Each confirmation_id works once, for 15 minutes, for the person who prepared it. If the audience grew since the preview, nothing is sent.",
    inputSchema: z.object({ confirmation_id: id("Confirmation") }),
    annotations: SEND, risk: "high",
  }, async ({ confirmation_id }) => {
    manage();
    // Claim it: RLS only allows the owner to mark an unused, unexpired one.
    let q = ctx.supabase.from("mcp_confirmations").update({ used_at: new Date().toISOString() }).eq("id", confirmation_id).eq("tool", "email_send").is("used_at", null);
    q = ctx.user.clientId ? q.eq("client_id", ctx.user.clientId) : q.is("client_id", null);
    const { data, error } = await q.select("payload").maybeSingle();
    check(error);
    if (!data) throw new ToolError("That confirmation has expired, was already used, or isn't yours. Prepare the send again.");
    const { content, target, total, send_at } = data.payload as { content: Content; target: Target; total: number; send_at?: string | null };
    if (send_at) {
      const when = checkSendAt(send_at);
      if ("error" in when) throw new ToolError(`${when.error} Prepare it again with a new time.`);
      const prep = await prepareSchedule(ctx.supabase, content, target, me);
      if ("error" in prep) throw new ToolError(prep.error);
      if (prep.recipients.length > total) throw new ToolError(`The audience grew from ${total} to ${prep.recipients.length} people since the preview. Prepare it again.`);
      // Claude's daily limit counts scheduled sends too.
      const since = new Date(Date.now() - 864e5).toISOString();
      const [{ data: c }, { data: q }] = await Promise.all([
        ctx.supabase.from("email_campaigns").select("total").eq("via", "claude").gte("created_at", since),
        ctx.supabase.from("scheduled_sends").select("total").eq("via", "claude").eq("channel", "email").neq("status", "canceled").gte("created_at", since),
      ]);
      const used = [...(c ?? []), ...(q ?? [])].reduce((n, r) => n + r.total, 0);
      if (used + prep.recipients.length > CLAUDE_DAILY) throw new ToolError(`Claude can send to ${CLAUDE_DAILY.toLocaleString()} people a day; ${used.toLocaleString()} are already used. Schedule this one from the admin instead.`);
      const ins = await ctx.supabase.from("scheduled_sends").insert({
        channel: "email", send_at: when.at.toISOString(), label: prep.label.slice(0, 300), subject: prep.subject.slice(0, 300),
        content: prep.content, recipients: prep.recipients, total: prep.recipients.length, via: "claude",
      }).select("id").single();
      check(ins.error);
      return { targetId: ins.data!.id, data: { result: `Scheduled for ${when.at.toISOString()} to ${prep.recipients.length} people.`, scheduled_id: ins.data!.id, send_at: when.at.toISOString() } };
    }
    const res = await deliver(ctx.supabase, content, target, { via: "claude", me, maxTotal: total });
    if (res.error && !res.sent) throw new ToolError(res.error);
    return { targetId: res.campaignId ?? confirmation_id, data: { result: res.ok ?? res.error, sent: res.sent, skipped: res.skipped, failed: res.failed, campaign_id: res.campaignId } };
  });

  defineTool(server, ctx, "email_scheduled_list", {
    title: "Scheduled emails",
    description: "Scheduled email sends (upcoming first), with when, who, how many and the result once sent.",
    inputSchema: z.object({ limit: limitArg }),
    annotations: READ,
  }, async ({ limit }) => {
    const { data, error } = await ctx.supabase.from("scheduled_sends").select("id, send_at, status, label, subject, total, sent, skipped, failed, error, via, created_at, finished_at")
      .eq("channel", "email").order("send_at", { ascending: false }).limit(limit);
    check(error);
    return { data: { scheduled: data } };
  });

  defineTool(server, ctx, "email_scheduled_cancel", {
    title: "Cancel a scheduled email",
    description: "Cancels a scheduled email that hasn't started sending. Confirm with the person first.",
    inputSchema: z.object({ scheduled_id: id("Scheduled send") }),
    annotations: WRITE,
  }, async ({ scheduled_id }) => {
    manage();
    const { data, error } = await ctx.supabase.from("scheduled_sends").update({ status: "canceled", canceled_by: ctx.user.id })
      .eq("id", scheduled_id).eq("channel", "email").eq("status", "scheduled").select("id").maybeSingle();
    check(error);
    if (!data) throw new ToolError("It has already started or finished (or doesn't exist), so it can't be canceled.");
    return { targetId: scheduled_id, data: { result: "Canceled." } };
  });

  defineTool(server, ctx, "email_history", {
    title: "Email history",
    description: "Recent bulk sends (with totals, and delivered/opened/clicked/bounced counts from Resend) and recent individual emails with their tracking, newest first. Opens are estimates (some apps block or prefetch the tracking image).",
    inputSchema: z.object({ limit: limitArg }),
    annotations: READ,
  }, async ({ limit }) => {
    const [c, s] = await Promise.all([
      ctx.supabase.from("email_campaigns").select("id, subject, audience_label, total, sent, skipped, failed, status, via, created_at").order("created_at", { ascending: false }).limit(limit),
      ctx.supabase.from("email_sends").select("to_email, subject, status, error, template_id, created_at, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, complained_at")
        .order("created_at", { ascending: false }).limit(limit),
    ]);
    check(c.error); check(s.error);
    const ids = (c.data ?? []).map((x) => x.id);
    const stats = ids.length ? await ctx.supabase.from("email_campaign_stats").select("campaign_id, delivered, opened, clicked, bounced, complained").in("campaign_id", ids) : { data: [], error: null };
    check(stats.error);
    const by = new Map((stats.data ?? []).map((x) => [x.campaign_id, x]));
    const bulk = (c.data ?? []).map((x) => { const t = by.get(x.id); return { ...x, delivered: t?.delivered ?? 0, opened: t?.opened ?? 0, clicked: t?.clicked ?? 0, bounced: t?.bounced ?? 0, complained: t?.complained ?? 0 }; });
    return { data: { bulk_sends: bulk, emails: s.data } };
  });
}
