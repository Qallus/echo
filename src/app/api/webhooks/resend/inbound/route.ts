import { createHmac, timingSafeEqual } from "node:crypto";
import { secrets } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Resend inbound email (event "email.received") -> the admin Inbox. No user
// session: the request must carry a valid Svix signature made with
// RESEND_WEBHOOK_SECRET, and only then is the service-role client used.
// The webhook has metadata only, so the body is fetched from Resend.
// Message content is stored as text and shown as text; it's never executed.

function verify(body: string, headers: Headers, secret: string | undefined): boolean {
  const id = headers.get("svix-id"), ts = headers.get("svix-timestamp"), sig = headers.get("svix-signature");
  if (!secret || !id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64"));
  return sig.split(" ").some((part) => {
    const [, value] = part.split(",");
    const given = Buffer.from(value ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const addr = (v: string) => {
  const m = v.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || null, email: m[2].trim().toLowerCase() } : { name: null, email: v.trim().toLowerCase() };
};

// Plain text from HTML when an email has no text part.
const htmlToText = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n").trim();

export async function POST(req: Request) {
  const body = await req.text();
  const conf = await secrets("RESEND_WEBHOOK_SECRET", "RESEND_API_KEY");
  if (!verify(body, req.headers, conf.RESEND_WEBHOOK_SECRET)) return new Response("Invalid signature", { status: 403 });
  const event = JSON.parse(body) as { type?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } };
  if (event.type !== "email.received" || !event.data?.email_id) return Response.json({ ok: true, ignored: true });

  const emailId = event.data.email_id;
  let text = "", attachments: { filename?: string; content_type?: string; size?: number }[] = [];
  const key = conf.RESEND_API_KEY;
  if (key) {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const full = (await res.json()) as { text?: string | null; html?: string | null; attachments?: typeof attachments };
      text = full.text?.trim() || (full.html ? htmlToText(full.html) : "");
      attachments = full.attachments ?? [];
    }
  }

  const from = addr(event.data.from ?? "");
  const supabase = createAdminClient();
  const { data: contact } = from.email ? await supabase.from("crm_contacts").select("id").eq("email", from.email).limit(1).maybeSingle() : { data: null };
  const { error } = await supabase.from("inbox_messages").upsert({
    channel: "email", provider_id: emailId, from_name: from.name, from_email: from.email || null, to_email: event.data.to?.[0]?.toLowerCase() ?? null,
    subject: (event.data.subject ?? "").slice(0, 300), body: text.slice(0, 100000), contact_id: contact?.id ?? null,
    meta: { attachments: attachments.slice(0, 20).map((a) => ({ name: a.filename, type: a.content_type, size: a.size })) },
  }, { onConflict: "provider_id", ignoreDuplicates: true });
  if (error) return new Response(error.message, { status: 500 });

  // Known sender: the email also lands on their CRM timeline.
  if (contact?.id) {
    // A retried webhook hits the (kind, external_id) unique index; that's fine.
    await supabase.from("crm_activities").insert({
      kind: "email", direction: "inbound", external_id: emailId, subject: event.data.subject?.slice(0, 300) ?? null, body: text.slice(0, 100000),
      from_addr: from.email, to_addr: event.data.to?.[0] ?? null, contact_id: contact.id,
    });
  }
  return Response.json({ ok: true });
}
