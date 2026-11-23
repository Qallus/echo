import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminAudit } from "@/lib/admin/audit";
import { campaignSlug, tagUrl } from "@/lib/analytics/utm";
import { postProblems, type SocialAccount, type SocialPost } from "./types";

// Saving a social post: shared by Admin -> Social and the connector tools.
// The caller checks social.manage (RLS checks again). Links to redial.si get
// campaign tags so Analytics credits the post.

export type PostInput = {
  body: string; image_url?: string | null; link_url?: string | null; account_ids: string[];
  campaign?: string | null; scheduled_at?: string | null; status: "draft" | "scheduled";
};
const SETUP = "Run supabase/migrations/20261124110000_social_posting.sql in Supabase first.";

export async function listAccounts(db: SupabaseClient): Promise<{ accounts: SocialAccount[]; setup: boolean }> {
  const { data, error } = await db.from("social_accounts").select("id, provider, kind, external_id, name, picture, expires_at, status, last_error, created_at, updated_at").order("provider").order("name");
  return { accounts: (data ?? []) as SocialAccount[], setup: !error };
}

export async function savePost(db: SupabaseClient, id: string | null, input: PostInput, via?: string): Promise<{ ok?: string; error?: string; id?: string; problems?: string[] }> {
  const body = (input.body ?? "").slice(0, 5000);
  const image = input.image_url?.trim() || null;
  const campaign = input.campaign?.trim() ? campaignSlug(input.campaign).slice(0, 80) : null;
  let link = input.link_url?.trim() || null;
  if (link && /^https?:\/\/(www\.)?redial\.si/i.test(link) && !/utm_source=/.test(link)) {
    link = tagUrl(link, { source: "social", medium: "social", campaign: campaign ?? "social-post" });
  }
  const { accounts, setup } = await listAccounts(db);
  if (!setup) return { error: SETUP };
  const chosen = accounts.filter((a) => input.account_ids.includes(a.id));
  if (input.status === "scheduled") {
    const problems = postProblems({ body, image_url: image }, chosen);
    if (!input.scheduled_at || Number.isNaN(Date.parse(input.scheduled_at))) problems.push("Pick when to publish.");
    else if (Date.parse(input.scheduled_at) < Date.now() - 60_000) problems.push("Pick a time in the future.");
    if (problems.length) return { error: problems.join(" "), problems };
  } else if (!body.trim()) return { error: "Write the post." };
  const row = {
    body, image_url: image, link_url: link, account_ids: chosen.map((a) => a.id), campaign,
    status: input.status, scheduled_at: input.status === "scheduled" ? new Date(input.scheduled_at!).toISOString() : input.scheduled_at ? new Date(input.scheduled_at).toISOString() : null,
  };
  const { data, error } = id
    ? await db.from("social_posts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["draft", "scheduled", "failed"]).select("id").maybeSingle()
    : await db.from("social_posts").insert(row).select("id").single();
  if (error) return { error: error.message };
  if (!data) return { error: "Published posts can't be changed." };
  await adminAudit(db, id ? "social.post.update" : "social.post.create", { type: "social_post", id: data.id }, { status: row.status, accounts: row.account_ids.length, ...(via ? { via } : {}) });
  return { ok: input.status === "scheduled" ? "Scheduled." : "Saved as a draft.", id: data.id };
}

export async function getPost(db: SupabaseClient, id: string) {
  const { data } = await db.from("social_posts").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as SocialPost | null;
}
