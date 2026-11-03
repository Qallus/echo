import { verifyUnsubscribe } from "@/lib/comms/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

// /unsubscribe?e=<email>&t=<token>. GET shows a confirm button; POST (the
// button, or an email app's one-click List-Unsubscribe) records it. No session:
// the signed token proves the link came from us, then the service-role client
// writes the address to email_unsubscribes.

const page = (title: string, body: string, form = "") => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Echo</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b;display:grid;place-items:center;min-height:100vh}main{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;max-width:420px;margin:16px}h1{font-size:20px;margin:0 0 8px}p{color:#52525b;line-height:1.5}button{background:#18181b;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer}@media(prefers-color-scheme:dark){body{background:#09090b;color:#fafafa}main{background:#18181b;border-color:#27272a}p{color:#a1a1aa}button{background:#fafafa;color:#18181b}}</style></head>
<body><main><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function params(url: string) {
  const u = new URL(url);
  const email = (u.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = u.searchParams.get("t") ?? "";
  return { email, token, ok: Boolean(email && token && email.length <= 200 && verifyUnsubscribe(email, token)) };
}

export async function GET(req: Request) {
  const { email, token, ok } = params(req.url);
  if (!ok) return page("Link not valid", "This unsubscribe link is incomplete or has been changed. Use the link from the email.");
  return page("Unsubscribe", `Stop emails from Echo to <strong>${esc(email)}</strong>?`,
    `<form method="post" action="/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`);
}

export async function POST(req: Request) {
  const { email, ok } = params(req.url);
  if (!ok) return page("Link not valid", "This unsubscribe link is incomplete or has been changed.");
  const { error } = await createAdminClient().from("email_unsubscribes").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return page("Something went wrong", "We couldn't record that. Please try again in a moment.");
  return page("You're unsubscribed", `${esc(email)} won't get marketing emails from Echo. Account emails, like receipts and sign-in links, still arrive.`);
}
