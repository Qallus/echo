import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { email as cleanEmail, ref, text, uuids } from "@/lib/crm/validate";
import { siteUrl } from "@/lib/notify/senders";
import { loadOrganization, orgMergeValues } from "@/lib/settings/organization";
import { audienceLabel, parseAudience, type Audience } from "./audience";
import {
  CATEGORIES, STATUSES, htmlTemplate, htmlToText, parseSchema, plainToSchema, renderTemplate, schemaToHtml, schemaToText, applyMerge,
  type EmailSchema, type TemplateMode, type TemplateStatus,
} from "./blocks";
import { AUDIENCE_CAP, audienceRecipients, contactRecipients, sendToRecipients, templateBody, unsubscribedSet, type Recipient } from "./send";

// The email service behind the admin Send screen, the template editor and the
// Claude connector. Callers check the staff permission first (requireStaff,
// or the connector's staff check); everything here runs as that person, so
// RLS (comms.view / comms.manage) applies to every read and write.
//
// Rules:
// - A bulk send (an audience, or more than BULK people) needs a test send of
//   the same email by the same person in the last 24 hours.
// - At most AUDIENCE_CAP people per send; Claude at most CLAUDE_DAILY a day.
// - Unsubscribed people are always skipped, and that's logged.

export const BULK = 25;
export const CLAUDE_DAILY = 5000;

// The staff member sending (from requireUser on the web, the token on the connector).
export type Sender = { id: string; email: string | null };
export type Content = { templateId?: string | null; subject?: string | null; body?: string | null; html?: string | null };
export type Target = { contactIds?: string[]; emails?: string[] | string; audience?: unknown; audienceId?: string | null; dealId?: string | null };
type Fail = { error: string };
const fail = (error: string): Fail => ({ error });
const isFail = (x: unknown): x is Fail => typeof x === "object" && x !== null && "error" in x;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export type TemplateInput = {
  name: string; subject?: string; preheader?: string | null; category?: string; status?: string; mode?: string;
  schema?: unknown; html?: string | null; revision?: number | null;
};

export async function saveTemplateRow(supabase: SupabaseClient, id: string | null, input: TemplateInput, via: "admin" | "claude") {
  const name = text(input.name, 120);
  if (!name) return fail("Give the template a name.");
  const mode: TemplateMode = input.mode === "html" ? "html" : "blocks";
  const status: TemplateStatus = STATUSES.includes(input.status as TemplateStatus) ? (input.status as TemplateStatus) : via === "claude" ? "draft" : "active";
  const category = CATEGORIES.includes(String(input.category)) ? String(input.category) : text(input.category, 40)?.toLowerCase() ?? "general";
  const preheader = text(input.preheader, 300);
  let schema: EmailSchema | null = null, html = "", body = "";
  if (mode === "blocks") {
    schema = parseSchema(input.schema);
    if (!schema || !schema.blocks.length) return fail("The template is empty. Add at least one block.");
    html = schemaToHtml(schema, { preheader: preheader ?? undefined, origin: siteUrl("") });
    body = schemaToText(schema);
  } else {
    html = typeof input.html === "string" ? input.html.slice(0, 500000) : "";
    if (!html.trim()) return fail("The HTML is empty.");
    body = htmlToText(htmlTemplate(html, { preheader }));
  }
  // HTML mode keeps the blocks it was converted from, so switching back is possible.
  const row = { name, subject: text(input.subject, 300) ?? "", preheader, category, status, mode, schema: schema ?? (mode === "html" ? parseSchema(input.schema) : null), html, body_text: body };

  if (id) {
    if (!ref(id)) return fail("Template not found.");
    let q = supabase.from("email_templates").update(row).eq("id", id);
    if (typeof input.revision === "number") q = q.eq("revision", input.revision);
    const { data, error } = await q.select("id, revision").maybeSingle();
    if (error) return fail(error.message);
    if (!data) {
      const { data: still } = await supabase.from("email_templates").select("revision").eq("id", id).maybeSingle();
      return fail(still ? "Someone else saved this template since you opened it. Reload to see their changes, then make yours again." : "Template not found.");
    }
    await adminAudit(supabase, "comms.template.update", { type: "email_template", id }, { name, status, mode, via });
    return { ok: "Template saved.", id: data.id as string, revision: data.revision as number };
  }
  const { data, error } = await supabase.from("email_templates").insert({ ...row, created_via: via }).select("id, revision").single();
  if (error) return fail(error.message);
  await adminAudit(supabase, "comms.template.create", { type: "email_template", id: data.id }, { name, status, mode, via });
  return { ok: "Template saved.", id: data.id as string, revision: data.revision as number };
}

// ---------------------------------------------------------------------------
// Content and recipients
// ---------------------------------------------------------------------------
type Resolved = { subject: string; html: string; text: string; templateId: string | null; template: { name: string; status: string } | null };

async function resolveContent(supabase: SupabaseClient, c: Content): Promise<Resolved | Fail> {
  const templateId = ref(c.templateId);
  if (templateId) {
    const { data: t } = await supabase.from("email_templates").select("id, name, subject, preheader, schema, html, mode, status").eq("id", templateId).maybeSingle();
    if (!t) return fail("Template not found.");
    const body = templateBody(t);
    if (!body) return fail("That template has no content yet.");
    const subject = text(c.subject, 300) ?? t.subject;
    if (!subject) return fail("Add a subject (the template doesn't have one).");
    return { subject, ...body, templateId, template: { name: t.name, status: t.status } };
  }
  const subject = text(c.subject, 300);
  if (!subject) return fail("Add a subject.");
  if (c.html?.trim()) {
    const html = htmlTemplate(c.html.slice(0, 500000));
    return { subject, html, text: htmlToText(html), templateId: null, template: null };
  }
  const body = text(c.body, 50000);
  if (!body) return fail("Write a message or pick a template.");
  return { subject, ...renderTemplate({ mode: "blocks", schema: plainToSchema(body), html: "" }, siteUrl("")), templateId: null, template: null };
}

type Targets = { recipients: Recipient[]; label: string; audience: Audience | null; dealId: string | null };

async function resolveTarget(supabase: SupabaseClient, t: Target): Promise<Targets | Fail> {
  let audience = t.audience ? parseAudience(t.audience) : null;
  let label = "";
  if (t.audienceId) {
    const { data: saved } = await supabase.from("email_audiences").select("name, definition").eq("id", ref(t.audienceId) ?? "").maybeSingle();
    if (!saved) return fail("Saved audience not found.");
    audience = parseAudience(saved.definition);
    label = saved.name;
  }
  if (t.audience && !audience) return fail("That audience isn't valid.");
  const dealId = ref(t.dealId);
  const { data: deal } = dealId ? await supabase.from("crm_deals").select("id, title, stage, value_cents, currency, contact_id").eq("id", dealId).maybeSingle() : { data: null };

  let recipients: Recipient[] = [];
  try {
    if (audience) recipients = await audienceRecipients(supabase, audience);
  } catch (e) { return fail(e instanceof Error ? e.message : "Couldn't load that audience."); }
  recipients.push(...await contactRecipients(supabase, uuids(t.contactIds), deal));
  const typed = (Array.isArray(t.emails) ? t.emails : (t.emails ?? "").split(/[,;\s]+/)).map((e) => cleanEmail(e)).filter((e): e is string => typeof e === "string");
  const known = new Set(recipients.map((r) => r.email.toLowerCase()));
  for (const e of typed.slice(0, 500)) if (!known.has(e)) { known.add(e); recipients.push({ email: e, deal_id: deal?.id ?? null, values: { email: e, site_url: siteUrl("/") } }); }
  // One copy per address.
  const seen = new Set<string>();
  recipients = recipients.filter((r) => { const e = r.email.toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true; });

  if (!label) {
    label = audience ? audienceLabel(audience) : `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`;
    if (audience && (t.contactIds?.length || typed.length)) label += " + people you added";
  }
  return { recipients, label, audience, dealId: deal?.id ?? null };
}

const isBulk = (t: Targets) => Boolean(t.audience) || t.recipients.length > BULK;

// Has this person sent a test of this email in the last 24 hours?
async function testedRecently(supabase: SupabaseClient, r: Resolved, me: Sender): Promise<boolean> {
  let q = supabase.from("email_sends").select("id").eq("status", "test").eq("sent_by", me.id).gte("created_at", new Date(Date.now() - 864e5).toISOString()).limit(1);
  q = r.templateId ? q.eq("template_id", r.templateId) : q.is("template_id", null).eq("subject", `[Test] ${r.subject}`.slice(0, 300));
  const { data } = await q;
  return Boolean(data?.length);
}

// ---------------------------------------------------------------------------
// Preview, test, send
// ---------------------------------------------------------------------------
export type Preview = {
  subject: string; template: { id: string; name: string; status: string } | null; label: string; bulk: boolean;
  total: number; sendable: number; unsubscribed: number; sample: { name: string | null; email: string }[];
  firstSubject: string; excerpt: string; html: string; tested: boolean; problems: string[];
};

export async function previewSend(supabase: SupabaseClient, c: Content, t: Target, me: Sender): Promise<Preview | Fail> {
  const content = await resolveContent(supabase, c);
  if (isFail(content)) return content;
  const targets = await resolveTarget(supabase, t);
  if (isFail(targets)) return targets;
  const blocked = await unsubscribedSet(supabase);
  const ok = targets.recipients.filter((r) => !blocked.has(r.email.toLowerCase()));
  const bulk = isBulk(targets);
  const tested = bulk ? await testedRecently(supabase, content, me) : true;
  const problems: string[] = [];
  if (!targets.recipients.length) problems.push("No one matches. Recipients need an email address.");
  if (targets.recipients.length > AUDIENCE_CAP) problems.push(`That's more than ${AUDIENCE_CAP.toLocaleString()} people. Narrow the audience down.`);
  if (bulk && !tested) problems.push("Send yourself a test of this email first (bulk sends need one from the last 24 hours).");
  if (content.template && content.template.status !== "active") problems.push(`The template is ${content.template.status}. Make it Active to send it.`);
  const first = ok[0];
  const values = { ...orgMergeValues(await loadOrganization(supabase)), ...(first?.values ?? {}), unsubscribe_url: "#" };
  return {
    subject: content.subject, template: content.templateId && content.template ? { id: content.templateId, ...content.template } : null,
    label: targets.label, bulk, total: targets.recipients.length, sendable: ok.length, unsubscribed: targets.recipients.length - ok.length,
    sample: ok.slice(0, 5).map((r) => ({ name: r.name ?? null, email: r.email })),
    firstSubject: applyMerge(content.subject, values), excerpt: applyMerge(content.text, values).slice(0, 600),
    html: applyMerge(content.html, values, true), tested, problems,
  };
}

// A test copy to the signed-in staff member, filled in with the first
// recipient's details when there are recipients (or an example person).
export async function sendTest(supabase: SupabaseClient, c: Content, t: Target | null, me: Sender) {
  const content = await resolveContent(supabase, c);
  if (isFail(content)) return content;
  if (!me.email) return fail("Your account has no email address.");
  let values: Recipient["values"] = { first_name: "Dana", last_name: "Whitfield", full_name: "Dana Whitfield", email: me.email, company: "Oasis Resorts", site_url: siteUrl("/") };
  if (t && (t.audience || t.audienceId || t.contactIds?.length || t.emails?.length)) {
    const targets = await resolveTarget(supabase, t);
    if (!isFail(targets) && targets.recipients[0]) values = { ...targets.recipients[0].values, email: targets.recipients[0].email };
  }
  const res = await sendToRecipients(supabase, { ...content, test: true }, [{ email: me.email, values }]);
  if (!res.sent) return fail(res.errors[0] ?? "The test didn't send.");
  return { ok: `Test sent to ${me.email}.` };
}

export type SendOutcome = { ok?: string; error?: string; sent?: number; skipped?: number; failed?: number; campaignId?: string | null };

export async function deliver(supabase: SupabaseClient, c: Content, t: Target, opts: { via: "admin" | "claude"; me: Sender; maxTotal?: number }): Promise<SendOutcome> {
  const content = await resolveContent(supabase, c);
  if (isFail(content)) return content;
  if (content.template && content.template.status !== "active") return fail(`The template is ${content.template.status}. Make it Active to send it.`);
  const targets = await resolveTarget(supabase, t);
  if (isFail(targets)) return targets;
  const n = targets.recipients.length;
  if (!n) return fail("No one to send to. Recipients need an email address.");
  if (n > AUDIENCE_CAP) return fail(`That's more than ${AUDIENCE_CAP.toLocaleString()} people. Narrow the audience down.`);
  // The audience is resolved again at send time; never send to more people than were shown.
  if (opts.maxTotal != null && n > opts.maxTotal) return fail(`The audience grew from ${opts.maxTotal} to ${n} people since the preview. Preview it again.`);
  const bulk = isBulk(targets);
  if (bulk && !(await testedRecently(supabase, content, opts.me))) return fail("Send yourself a test of this email first (bulk sends need one from the last 24 hours).");
  if (opts.via === "claude") {
    const { data: recent } = await supabase.from("email_campaigns").select("total").eq("via", "claude").gte("created_at", new Date(Date.now() - 864e5).toISOString());
    const used = (recent ?? []).reduce((s, r) => s + r.total, 0);
    if (used + n > CLAUDE_DAILY) return fail(`Claude can send to ${CLAUDE_DAILY.toLocaleString()} people a day; ${used.toLocaleString()} are already used today. Send this one from the admin instead.`);
  }

  const recipients = targets.recipients.map((r) => ({ ...r, deal_id: r.deal_id ?? targets.dealId }));
  const out = await sendAsCampaign(supabase, content, recipients, { label: targets.label, audience: targets.audience, via: opts.via });
  if (out.campaignId !== undefined) {
    await adminAudit(supabase, "comms.email.send", { type: out.campaignId ? "email_campaign" : "email_template", id: out.campaignId ?? content.templateId ?? "message" },
      { sent: out.sent, skipped: out.skipped, failed: out.failed, via: opts.via, audience: targets.label, deal_id: targets.dealId });
  }
  return out;
}

// Sends to a resolved list, as a bulk send (email_campaigns row) when it's
// more than one person or an audience, and records the totals.
async function sendAsCampaign(supabase: SupabaseClient, content: Resolved, recipients: Recipient[],
  info: { label: string; audience: Audience | null; via: "admin" | "claude"; createdBy?: string | null }): Promise<SendOutcome> {
  let campaignId: string | null = null;
  if (recipients.length > 1 || info.audience) {
    const { data: camp, error } = await supabase.from("email_campaigns").insert({
      template_id: content.templateId, subject: content.subject, audience: info.audience ?? {}, audience_label: info.label.slice(0, 300), total: recipients.length, via: info.via,
      ...(info.createdBy ? { created_by: info.createdBy } : {}),
    }).select("id").single();
    if (error) return fail(error.message);
    campaignId = camp.id;
  }
  const res = await sendToRecipients(supabase, { ...content, campaignId }, recipients);
  if (campaignId) {
    await supabase.from("email_campaigns").update({
      sent: res.sent, skipped: res.skipped, failed: res.failed, finished_at: new Date().toISOString(),
      status: res.failed && !res.sent ? "failed" : res.failed ? "partial" : "sent",
    }).eq("id", campaignId);
  }
  const parts = [`${res.sent} sent`, res.skipped && `${res.skipped} skipped (unsubscribed)`, res.failed && `${res.failed} failed`].filter(Boolean).join(", ");
  return { ...(res.sent ? { ok: `${parts}.` } : { error: `${parts}.${res.errors[0] ? ` ${res.errors[0]}` : ""}` }), sent: res.sent, skipped: res.skipped, failed: res.failed, campaignId };
}

// ---------------------------------------------------------------------------
// Scheduled sends
// ---------------------------------------------------------------------------
// Scheduling checks the email exactly like sending now (Active template,
// caps, a recent test for bulk sends), then captures the recipient list.
// At send time the template must still be Active and unchanged; otherwise
// the send is held, since what goes out has to be what was tested.
export type ScheduledEmail = { content: Content & { revision: number | null }; recipients: Recipient[]; label: string; subject: string };

export async function prepareSchedule(supabase: SupabaseClient, c: Content, t: Target, me: Sender): Promise<ScheduledEmail | Fail> {
  const preview = await previewSend(supabase, c, t, me);
  if (isFail(preview)) return preview;
  if (preview.problems.length) return fail(preview.problems[0]);
  const [content, targets] = await Promise.all([resolveContent(supabase, c), resolveTarget(supabase, t)]);
  if (isFail(content)) return content;
  if (isFail(targets)) return targets;
  const { data: tpl } = content.templateId ? await supabase.from("email_templates").select("revision").eq("id", content.templateId).maybeSingle() : { data: null };
  return {
    content: { templateId: content.templateId, subject: text(c.subject, 300), body: text(c.body, 50000), html: c.html?.slice(0, 200000) ?? null, revision: tpl?.revision ?? null },
    recipients: targets.recipients.map((r) => ({ ...r, deal_id: r.deal_id ?? targets.dealId })),
    label: targets.label, subject: content.subject,
  };
}

export async function deliverScheduled(db: SupabaseClient, row: { content: unknown; recipients: unknown; label: string | null; via: "admin" | "claude"; created_by: string | null }): Promise<SendOutcome> {
  const c = (row.content ?? {}) as Content & { revision?: number | null };
  const content = await resolveContent(db, c);
  if (isFail(content)) return content;
  if (content.template && content.template.status !== "active") return fail(`Held: the template was set to ${content.template.status} after this was scheduled.`);
  if (content.templateId && c.revision != null) {
    const { data: tpl } = await db.from("email_templates").select("revision").eq("id", content.templateId).maybeSingle();
    if (tpl?.revision !== c.revision) return fail("Held: the template was edited after this was scheduled. Send yourself a test of the new version and schedule it again.");
  }
  const recipients = (Array.isArray(row.recipients) ? row.recipients : []) as Recipient[];
  if (!recipients.length) return fail("No one to send to.");
  return sendAsCampaign(db, content, recipients.slice(0, AUDIENCE_CAP), { label: row.label ?? "", audience: null, via: row.via, createdBy: row.created_by });
}

// ---------------------------------------------------------------------------
// Saved audiences
// ---------------------------------------------------------------------------
export async function saveAudienceRow(supabase: SupabaseClient, id: string | null, input: { name: string; description?: string | null; definition: unknown }) {
  const name = text(input.name, 80);
  if (!name) return fail("Name the audience.");
  const definition = parseAudience(input.definition);
  if (!definition) return fail("That audience isn't valid.");
  const row = { name, description: text(input.description, 300), definition };
  const { data, error } = id && ref(id)
    ? await supabase.from("email_audiences").update(row).eq("id", id).select("id").single()
    : await supabase.from("email_audiences").insert(row).select("id").single();
  if (error) return fail(error.code === "23505" ? "There's already an audience with that name." : error.message);
  await adminAudit(supabase, id ? "comms.audience.update" : "comms.audience.create", { type: "email_audience", id: data.id }, { name });
  return { ok: "Audience saved.", id: data.id as string };
}
