import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { twilioSms } from "@/lib/comms/twilio";
import { sendEmail, siteUrl, toE164 } from "@/lib/notify/senders";
import { render, type Vars } from "./eval";
import { columnReady } from "@/lib/schema-ready";
import { segmentsOf } from "@/lib/sms/pricing";

// The Call Tree blocks that reach outside the call: CRM lookup and update,
// text and email, and dial by name. They run in the call runner with the
// service role (Twilio-signed webhooks only).
//
// The CRM is Redial's internal one (Admin → Contacts and Leads), so CRM blocks
// only act when the call tree's owner is staff who can manage the CRM. For
// anyone else they take the "not found" / "next" path and change nothing.

type Db = SupabaseClient;
const CRM_ROLES = ["owner", "admin", "support", "marketing"]; // roles with crm.manage

export async function canUseCrm(db: Db, ownerId: string): Promise<boolean> {
  const { data } = await db.from("platform_staff").select("role").eq("user_id", ownerId).maybeSingle();
  return Boolean(data && CRM_ROLES.includes(data.role));
}

const last10 = (n: string) => n.replace(/\D/g, "").slice(-10);

// Find the caller in the CRM by phone number.
export async function crmLookup(db: Db, ownerId: string, from: string) {
  const digits = last10(from);
  if (digits.length < 10 || !(await canUseCrm(db, ownerId))) return null;
  const q = db.from("crm_contacts").select("id, first_name, last_name, email, phone, role, company_id, company:crm_companies(name)")
    .ilike("phone", `%${digits.slice(-4)}%`).limit(200);
  // Staff CRM only (customer workspace contacts stay in their workspace).
  const { data } = await ((await columnReady("crm_contacts", "workspace_id", db)) ? q.is("workspace_id", null) : q);
  const hit = (data ?? []).find((c) => last10(c.phone ?? "") === digits);
  if (!hit) return null;
  const company = (hit.company as unknown as { name: string } | null)?.name ?? "";
  return { id: hit.id, name: [hit.first_name, hit.last_name].filter(Boolean).join(" "), email: hit.email ?? "", company, role: hit.role as string, companyId: hit.company_id as string | null };
}

// Log the call on the caller's CRM record, adding them as a new lead first
// when they aren't in the CRM yet. Returns the contact id (or null).
export async function crmUpdate(db: Db, ownerId: string, vars: Vars, cfg: { note?: string; tags?: string[]; createLead?: boolean; interest?: string }, flowName: string) {
  if (!(await canUseCrm(db, ownerId))) return null;
  let contactId = String(vars.flow.contact_id ?? "") || null;
  const from = toE164(vars.call.from ?? "");
  if (!contactId && from) contactId = (await crmLookup(db, ownerId, from))?.id ?? null;
  if (!contactId && cfg.createLead !== false && from) {
    const [first, ...rest] = (vars.call.callerName || "").trim().split(/\s+/).filter(Boolean);
    const caller = first && !/^(wireless|unknown|private|anonymous)/i.test(vars.call.callerName ?? "") ? { first: titleCase(first), last: titleCase(rest.join(" ")) || null } : { first: "Caller", last: from };
    const { data, error } = await db.from("crm_contacts").insert({
      first_name: caller.first.slice(0, 100), last_name: caller.last?.slice(0, 100) ?? null, phone: from, role: "lead", lead_status: "new",
      source: `Phone · ${flowName}`.slice(0, 100), interest: render(cfg.interest ?? "", vars).slice(0, 200) || null, owner_id: ownerId, created_by: ownerId,
      tags: (cfg.tags ?? []).map((t) => render(t, vars).slice(0, 40)).filter(Boolean),
    }).select("id").single();
    if (error) console.error("[call tree] new lead", error.message);
    contactId = data?.id ?? null;
    if (contactId) vars.flow.new_lead = "yes";
  } else if (contactId && cfg.tags?.length) {
    const { data: c } = await db.from("crm_contacts").select("tags").eq("id", contactId).maybeSingle();
    const tags = [...new Set([...(c?.tags ?? []), ...cfg.tags.map((t) => render(t, vars).slice(0, 40)).filter(Boolean)])].slice(0, 20);
    await db.from("crm_contacts").update({ tags }).eq("id", contactId);
  }
  if (contactId) {
    vars.flow.contact_id = contactId;
    const note = render(cfg.note || `Called ${vars.line.number} (${flowName}).`, vars).slice(0, 10000);
    await db.from("crm_activities").insert({ kind: "call", direction: "inbound", body: note, status: "logged", contact_id: contactId, created_by: ownerId }).then(({ error }) => {
      if (error) console.error("[call tree] crm note", error.message);
    });
  }
  return contactId;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Text or email someone from the call tree. "{{call.from}}" texts the caller.
// Texts come from the line's own number; numbers that replied STOP are skipped.
export async function sendFlowMessage(db: Db, line: { number: string; id?: string }, vars: Vars, cfg: { channel: "sms" | "email"; to: string; body: string; subject?: string; enabled?: boolean }, callId: string | null) {
  if (cfg.enabled === false) return { ok: true, skipped: "switched off" };
  const body = render(cfg.body, vars).trim();
  const to = render(cfg.to, vars).trim();
  if (!to || !body) return { ok: false, error: "Nothing to send." };
  if (cfg.channel === "sms") {
    const number = toE164(to);
    if (!number) return { ok: false, error: "Not a phone number." };
    const { data: stop } = await db.from("phone_opt_outs").select("number").eq("number", number).maybeSingle();
    if (stop) return { ok: false, error: "They replied STOP." };
    const text = body.slice(0, 1600);
    const segments = segmentsOf(text);
    // Counted against the line owner's texts (after the SMS billing migration).
    const billed = await columnReady("phone_messages", "segments", db);
    if (billed && line.id) {
      const { data: usage } = await db.rpc("sms_line_usage", { p_line: line.id });
      if (usage && (usage as { remaining: number }).remaining < segments) return { ok: false, error: "Out of texts: buy a text pack." };
    }
    const res = await twilioSms(number, text, line.number);
    await db.from("phone_messages").insert({
      direction: "outbound", from_number: line.number, to_number: number, body: text, status: res.ok ? res.status ?? "queued" : "failed",
      error: res.error?.slice(0, 500) ?? null, twilio_sid: res.sid ?? null, contact_id: String(vars.flow.contact_id ?? "") || null,
      ...(billed && line.id ? { line_id: line.id, segments } : {}),
    }).then(({ error }) => { if (error) console.error("[call tree] sms log", error.message); });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }
  const subject = render(cfg.subject || `Call from ${vars.call.callerName || vars.call.from}`, vars).slice(0, 200);
  const link = callId ? siteUrl(`/calls?call=${callId}`) : siteUrl("/calls");
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${esc(body).replace(/\n/g, "<br>")}<p><a href="${esc(link)}">Open the call in Redial</a></p></div>`;
  let sent = 0;
  for (const addr of to.split(/[,;\s]+/).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)).slice(0, 5)) {
    const r = await sendEmail(addr, subject, html, `${body}\n\nOpen the call: ${link}`);
    if (r.ok) sent++;
  }
  return sent ? { ok: true } : { ok: false, error: "No email address or the email couldn't be sent." };
}

// Dial by name: who on the line matches what the caller said (Directory and
// extensions, by first name, last name or full name).
const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);

// The line's owner (rings their phones) and the people they shared the line
// with (their profile phone), then extensions and Directory contacts.
type Target = { owner?: true; extensionId?: string; directoryId?: string; number?: string };
export async function namesOnLine(db: Db, line: { id: string; owner_id: string }) {
  const [{ data: dir }, { data: ext }, { data: grants }] = await Promise.all([
    db.from("redial_directory").select("id, label").eq("line_id", line.id).limit(200),
    db.from("redial_extensions").select("id, name").eq("line_id", line.id).limit(200),
    db.from("redial_line_grants").select("user_id").eq("line_id", line.id).limit(50),
  ]);
  const ids = [line.owner_id, ...(grants ?? []).map((g) => g.user_id as string)];
  const { data: profiles } = await db.from("profiles").select("id, full_name, phone").in("id", ids);
  const people: { name: string; target: Target }[] = [];
  for (const pr of profiles ?? []) {
    if (!pr.full_name) continue;
    if (pr.id === line.owner_id) people.push({ name: pr.full_name, target: { owner: true } });
    else { const n = toE164(pr.phone ?? ""); if (n) people.push({ name: pr.full_name, target: { number: n } }); }
  }
  return [
    ...people,
    ...(ext ?? []).map((e) => ({ name: e.name as string, target: { extensionId: e.id as string } as Target })),
    ...(dir ?? []).map((d) => ({ name: d.label as string, target: { directoryId: d.id as string } as Target })),
  ];
}

export function matchName<T extends { name: string }>(people: T[], said: string): T | null {
  const heard = new Set(words(said));
  if (!heard.size) return null;
  let best: { p: T; score: number } | null = null;
  for (const p of people) {
    const ws = words(p.name);
    const hits = ws.filter((w) => heard.has(w)).length;
    if (!hits) continue;
    const score = hits / ws.length + (hits === ws.length ? 1 : 0);
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p ?? null;
}
