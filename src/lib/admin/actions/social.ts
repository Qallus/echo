"use server";

import { revalidatePath } from "next/cache";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { isUuid } from "@/lib/data";
import { savePost, type PostInput } from "@/lib/social/posts";
import { publishPost } from "@/lib/social/publish";
import { createClient } from "@/lib/supabase/server";

// Admin -> Social (social.manage, audited).
type Result = { ok?: string; error?: string; id?: string };
const done = (r: Result) => { revalidatePath("/admin/social"); return r; };

export async function saveSocialPost(id: string | null, input: PostInput): Promise<Result> {
  await requireStaff("social.manage");
  if (id && !isUuid(id)) return { error: "Not found." };
  const r = await savePost(await createClient(), id, input);
  return done(r);
}

export async function publishSocialPostNow(id: string): Promise<Result> {
  await requireStaff("social.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const r = await publishPost(supabase, id);
  await adminAudit(supabase, "social.post.publish", { type: "social_post", id }, { status: r.status });
  return done(r.status === "published" ? { ok: "Published." } : r.status === "partly_published" ? { ok: `Published to some accounts. ${r.error ?? ""}` } : { error: r.error ?? "Couldn't publish." });
}

export async function unscheduleSocialPost(id: string): Promise<Result> {
  await requireStaff("social.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("social_posts").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "scheduled");
  if (error) return { error: error.message };
  await adminAudit(supabase, "social.post.unschedule", { type: "social_post", id });
  return done({ ok: "Moved back to drafts." });
}

export async function deleteSocialPost(id: string): Promise<Result> {
  await requireStaff("social.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("social_posts").delete().eq("id", id).neq("status", "publishing");
  if (error) return { error: error.message };
  await adminAudit(supabase, "social.post.delete", { type: "social_post", id });
  return done({ ok: "Deleted from Redial (anything already published stays on the network)." });
}

// Forget an account and its token (reconnect to add it again).
export async function removeSocialAccount(id: string): Promise<Result> {
  await requireStaff("social.manage");
  if (!isUuid(id)) return { error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("social_accounts").delete().eq("id", id).select("provider, name").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Not found." };
  await adminAudit(supabase, "social.disconnect", { type: "social_account", id }, { provider: data.provider, name: data.name });
  return done({ ok: `${data.name} disconnected.` });
}
