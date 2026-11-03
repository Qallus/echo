import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import webpush from "web-push";

// Email (Resend), SMS (Twilio) and push (Web Push). Each returns
// { ok, id?, error? } and never throws, so one failed channel doesn't stop
// the others. Patterns ported from Channel-Cast-OS lib/server/{email,twilio}.ts.

export type SendResult = { ok: boolean; id?: string; error?: string; gone?: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Echo-branded email, matching the auth email templates.
export function emailHtml({ title, body, url, cta = "Open in Echo" }: { title: string; body?: string | null; url?: string | null; cta?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e5e5e5;border-radius:16px">
<tr><td style="padding:28px 32px 0;font-weight:600;letter-spacing:.2em;font-size:15px">ECHO</td></tr>
<tr><td style="padding:20px 32px 0;font-size:20px;font-weight:600;line-height:1.3">${esc(title)}</td></tr>
${body ? `<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#404040">${esc(body)}</td></tr>` : ""}
${url ? `<tr><td style="padding:24px 32px 0"><a href="${esc(url)}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">${esc(cta)}</a></td></tr>` : ""}
<tr><td style="padding:28px 32px 28px;font-size:12px;color:#737373;border-top:1px solid #f0f0f0;margin-top:24px">You're receiving this because of your Echo notification settings. <a href="${esc(siteUrl("/settings/notifications"))}" style="color:#737373">Manage notifications</a></td></tr>
</table></td></tr></table></body></html>`;
}

export function siteUrl(path: string) {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export async function sendEmail(to: string, subject: string, html: string, text: string,
  opts: { headers?: Record<string, string>; replyTo?: string; idempotencyKey?: string } = {}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return { ok: false, error: "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}) },
      body: JSON.stringify({
        from: from.includes("<") ? from : `Echo <${from}>`, to: [to], subject, html, text,
        ...(opts.headers ? { headers: opts.headers } : {}),
        // Replies go to the team inbox.
        ...(opts.replyTo ?? process.env.RESEND_REPLY_TO ? { reply_to: opts.replyTo ?? process.env.RESEND_REPLY_TO } : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, id: json.id } : { ok: false, error: json.message ?? `Resend ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed." };
  }
}

// "+1 (555) 123-4567" -> "+15551234567". US numbers without a country code get +1.
export function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const d = digits.replace(/\+/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "SMS isn't configured (TWILIO_* env vars)." };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    return res.ok ? { ok: true, id: json.sid } : { ok: false, error: json.message ?? `Twilio ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS failed." };
  }
}

export async function sendPush(subscription: webpush.PushSubscription, payload: { title: string; body?: string | null; url?: string | null }): Promise<SendResult> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return { ok: false, error: "Push isn't configured (VAPID keys)." };
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@echo.redial.si", pub, priv);
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, error: e instanceof Error ? e.message : "Push failed.", gone: status === 404 || status === 410 };
  }
}

// Verification codes are stored as hmac(channel_id:code) with NOTIFY_SECRET,
// the same secret the database holds in Vault (it checks codes itself).
export function codeHash(channelId: string, code: string) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) throw new Error("NOTIFY_SECRET is not set.");
  return createHmac("sha256", secret).update(`${channelId}:${code}`).digest("hex");
}

export function secretMatches(given: string | null) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
