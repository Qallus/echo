import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptKey } from "@/lib/ai/keys";
import { linkedinPost } from "./linkedin";
import { facebookPost, instagramPost } from "./meta";
import type { SocialAccount, SocialPost, SocialResult } from "./types";

// Publishes a post to each of its accounts and records what happened per
// account. Runs as staff (Publish now) or from the scheduled job (service
// role). A post is claimed first (status publishing), so it never goes out
// twice.

const withLink = (body: string, link: string | null) => (link && !body.includes(link) ? `${body.trim()}\n\n${link}` : body.trim());

async function sendTo(a: SocialAccount, p: SocialPost): Promise<{ id: string; url: string }> {
  if (a.status !== "active" || !a.access_token) throw new Error(`${a.name} needs to be reconnected.`);
  if (a.expires_at && new Date(a.expires_at) < new Date()) throw new Error(`${a.name}'s sign-in expired: reconnect it in Admin → Social.`);
  const token = decryptKey(a.access_token);
  if (a.provider === "linkedin") return linkedinPost(token, a.external_id, withLink(p.body, p.link_url), p.image_url);
  if (a.provider === "facebook") return facebookPost(token, a.external_id, p.body.trim(), p.image_url, p.link_url);
  return instagramPost(token, a.external_id, withLink(p.body, p.link_url), p.image_url);
}

export async function publishPost(db: SupabaseClient, postId: string): Promise<{ status: SocialPost["status"]; results: SocialResult[]; error?: string }> {
  const { data: claimed } = await db.from("social_posts").update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", postId).in("status", ["draft", "scheduled", "failed", "partly_published"]).select("*").maybeSingle();
  if (!claimed) return { status: "failed", results: [], error: "This post is already publishing or published." };
  const post = claimed as SocialPost;
  const { data: accts } = await db.from("social_accounts").select("*").in("id", post.account_ids.length ? post.account_ids : ["00000000-0000-0000-0000-000000000000"]);
  const accounts = (accts ?? []) as SocialAccount[];
  // Accounts that already got this post (a retry after a partial failure) are skipped.
  const before = (post.results ?? []).filter((r) => r.ok);
  const results: SocialResult[] = [...before];
  for (const a of accounts) {
    if (before.some((r) => r.account_id === a.id)) continue;
    try {
      const r = await sendTo(a, post);
      results.push({ account_id: a.id, provider: a.provider, name: a.name, ok: true, url: r.url, id: r.id, at: new Date().toISOString() });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 300) : "Failed.";
      results.push({ account_id: a.id, provider: a.provider, name: a.name, ok: false, error, at: new Date().toISOString() });
      if (/reconnect|expired/i.test(error)) await db.from("social_accounts").update({ status: "expired", last_error: error, updated_at: new Date().toISOString() }).eq("id", a.id);
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const status: SocialPost["status"] = !accounts.length ? "failed" : ok === accounts.length ? "published" : ok ? "partly_published" : "failed";
  const error = !accounts.length ? "No accounts chosen (or they were disconnected)." : results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`).join(" · ").slice(0, 1000) || null;
  await db.from("social_posts").update({ status, results, error, published_at: ok ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", post.id);
  return { status, results, error: error ?? undefined };
}

// Scheduled job: publish posts whose time has come (a few per run).
export async function publishDuePosts(db: SupabaseClient, max = 10): Promise<number> {
  const { data, error } = await db.from("social_posts").select("id").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(max);
  if (error) return 0; // before the social posting migration
  let n = 0;
  for (const p of data ?? []) { await publishPost(db, p.id); n++; }
  return n;
}
