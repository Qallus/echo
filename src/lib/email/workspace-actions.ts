"use server";

import { revalidatePath } from "next/cache";
import { getMyProfile, isUuid, requireUser } from "@/lib/data";
import { crmScope } from "@/lib/crm/scope";
import { sendEmail } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";

// Emails from the user dashboard (the Emails page). They go out through
// Redial's email service as "Name via Redial", and replies go to the sender's
// own email address. One email per person (nobody sees the other recipients).
// Limits keep Redial's sending reputation safe: 25 people per send, 150 a day.

type Result = { ok?: string; error?: string; sent?: number };

const PER_SEND = 25;
const PER_DAY = 150;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function workspaceId(): Promise<string | null> {
  const scope = await crmScope();
  return scope.staff ? null : scope.workspaceId;
}

export async function sendWorkspaceEmail(input: { to: string[]; subject: string; body: string; contactIds?: Record<string, string> }): Promise<Result> {
  const user = await requireUser();
  const ws = await workspaceId();
  if (!ws) return { error: "Open Emails from your dashboard." };
  const subject = String(input.subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  const body = String(input.body ?? "").trim().slice(0, 50000);
  if (!subject) return { error: "Add a subject." };
  if (!body) return { error: "Write a message." };
  const to = [...new Set((Array.isArray(input.to) ? input.to : []).map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL.test(e)))];
  if (!to.length) return { error: "Add who it goes to." };
  if (to.length > PER_SEND) return { error: `Up to ${PER_SEND} people per email.` };

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from("workspace_emails").select("id", { count: "exact", head: true }).eq("sent_by", user.id).gte("created_at", since);
  if ((count ?? 0) + to.length > PER_DAY) return { error: `That's over today's limit of ${PER_DAY} emails. Try again tomorrow.` };

  const profile = await getMyProfile();
  const name = profile.fullName?.trim() || user.email;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b">${esc(body).replace(/\n/g, "<br>")}</div>`
    + `<p style="margin-top:24px;font-family:system-ui,sans-serif;font-size:12px;color:#71717a">Sent by ${esc(name)} with Redial. Reply to this email to answer ${esc(name)} directly.</p>`;
  const text = `${body}\n\n--\nSent by ${name} with Redial. Reply to this email to answer ${name} directly.`;

  let sent = 0;
  const failed: string[] = [];
  for (const email of to) {
    const res = await sendEmail(email, subject, html, text, { fromName: name, replyTo: user.email });
    const contact = input.contactIds?.[email];
    await supabase.from("workspace_emails").insert({
      workspace_id: ws, to_email: email, subject, body, status: res.ok ? "sent" : "failed",
      provider_id: res.ok ? res.id ?? null : null, error: res.ok ? null : (res.error ?? "Not sent").slice(0, 1000),
      contact_id: contact && isUuid(contact) ? contact : null,
    });
    if (res.ok) sent++; else failed.push(`${email}: ${res.error ?? "not sent"}`);
  }
  revalidatePath("/email");
  if (failed.length) return { error: `Sent to ${sent}. Not sent: ${failed.join("; ")}`, sent };
  return { ok: sent === 1 ? "Sent." : `Sent to ${sent} people.`, sent };
}

export async function saveEmailTemplate(input: { id?: string; name: string; subject: string; body: string }): Promise<Result & { id?: string }> {
  await requireUser();
  const ws = await workspaceId();
  if (!ws) return { error: "Open Emails from your dashboard." };
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) return { error: "Name the template." };
  const row = { name, subject: String(input.subject ?? "").slice(0, 300), body: String(input.body ?? "").slice(0, 50000) };
  const supabase = await createClient();
  const res = input.id && isUuid(input.id)
    ? await supabase.from("workspace_email_templates").update({ ...row, updated_at: new Date().toISOString() }).eq("id", input.id).select("id").maybeSingle()
    : await supabase.from("workspace_email_templates").insert({ ...row, workspace_id: ws }).select("id").maybeSingle();
  if (res.error) return { error: res.error.message };
  revalidatePath("/email");
  return { ok: "Template saved.", id: res.data?.id };
}

export async function deleteEmailTemplate(id: string): Promise<Result> {
  await requireUser();
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("workspace_email_templates").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Only the person who made it, or a workspace owner or admin, can delete it." };
  revalidatePath("/email");
  return { ok: "Deleted." };
}
