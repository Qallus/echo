// Social posting types and limits, shared by the admin page, the server and
// the connector tools (supabase/migrations/20261124110000_social_posting.sql).

export type SocialProvider = "linkedin" | "facebook" | "instagram";
export type SocialAccount = {
  id: string; provider: SocialProvider; kind: "person" | "page"; external_id: string; name: string; picture: string | null;
  access_token?: string | null; expires_at: string | null; status: "active" | "expired" | "error" | "disconnected"; last_error: string | null;
  created_at: string; updated_at: string;
};
export type SocialResult = { account_id: string; provider: SocialProvider; name: string; ok: boolean; url?: string; id?: string; error?: string; at: string };
export type SocialPostStatus = "draft" | "scheduled" | "publishing" | "published" | "partly_published" | "failed";
export type SocialPost = {
  id: string; body: string; image_url: string | null; link_url: string | null; account_ids: string[]; status: SocialPostStatus;
  scheduled_at: string | null; published_at: string | null; results: SocialResult[]; error: string | null; campaign: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};

export const POST_STATUSES: { id: SocialPostStatus; label: string }[] = [
  { id: "draft", label: "Draft" }, { id: "scheduled", label: "Scheduled" }, { id: "publishing", label: "Publishing" },
  { id: "published", label: "Published" }, { id: "partly_published", label: "Partly published" }, { id: "failed", label: "Failed" },
];
export const PROVIDER_LABEL: Record<SocialProvider, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram" };
// Most characters each network takes in a post.
export const LIMITS: Record<SocialProvider, number> = { linkedin: 3000, facebook: 5000, instagram: 2200 };

// Checks a post against the accounts it goes to. Returns problems in plain words.
export function postProblems(p: { body: string; image_url: string | null }, accounts: Pick<SocialAccount, "provider" | "name" | "status">[]): string[] {
  const out: string[] = [];
  if (!p.body.trim()) out.push("Write the post.");
  if (!accounts.length) out.push("Pick at least one account.");
  for (const a of accounts) {
    if (p.body.length > LIMITS[a.provider]) out.push(`${PROVIDER_LABEL[a.provider]} takes up to ${LIMITS[a.provider]} characters.`);
    if (a.provider === "instagram" && !p.image_url) out.push("Instagram posts need an image.");
    if (a.status !== "active") out.push(`${a.name} needs to be reconnected.`);
  }
  if (p.image_url && !/^https:\/\//i.test(p.image_url)) out.push("The image link must start with https://.");
  return [...new Set(out)];
}
