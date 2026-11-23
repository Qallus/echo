import { AdminPage } from "@/components/admin/admin-ui";
import { can, requireStaff } from "@/lib/admin/guard";
import { secrets } from "@/lib/secrets";
import { listAccounts } from "@/lib/social/posts";
import type { SocialPost } from "@/lib/social/types";
import { createClient } from "@/lib/supabase/server";
import { SocialView } from "./social-view";

export const metadata = { title: "Social · Admin · Redial" };

const ERRORS: Record<string, string> = {
  linkedin_not_configured: "Add the LinkedIn Client ID and secret in Settings → Integrations → Social media first.",
  meta_not_configured: "Add the Meta App ID and secret in Settings → Integrations → Social media first.",
  linkedin_denied: "LinkedIn wasn't connected (you cancelled or declined).", meta_denied: "Facebook wasn't connected (you cancelled or declined).",
  linkedin_state: "That LinkedIn sign-in expired. Try Connect LinkedIn again.", meta_state: "That Facebook sign-in expired. Try Connect Facebook again.",
  linkedin_failed: "LinkedIn connection failed. Check the redirect URL in the LinkedIn app, then try again.",
  meta_failed: "Facebook connection failed. Check the redirect URL and permissions in the Meta app, then try again.",
  meta_no_pages: "Facebook connected, but no Pages came back. Make sure you picked the Redial Page when asked.",
};

// Posts to Redial's LinkedIn, Facebook Page and Instagram: connect the
// accounts, write and schedule posts (or let agents draft them), and see
// what went out. Published by the scheduled job at their time.
export default async function SocialPage({ searchParams }: { searchParams: Promise<{ connected?: string; count?: string; error?: string }> }) {
  const staff = await requireStaff("social.manage");
  const supabase = await createClient();
  const [{ accounts, setup }, { data: posts }, keys, sp] = await Promise.all([
    listAccounts(supabase),
    supabase.from("social_posts").select("*").order("created_at", { ascending: false }).limit(500),
    secrets("LINKEDIN_CLIENT_ID", "META_APP_ID"),
    searchParams,
  ]);
  const notice = sp.error ? { error: ERRORS[sp.error] ?? "Something went wrong." }
    : sp.connected ? { ok: `${sp.connected === "meta" ? "Facebook" : "LinkedIn"} connected${sp.count ? `: ${sp.count} account${sp.count === "1" ? "" : "s"}` : ""}.` } : null;

  return (
    <AdminPage title="Social" description="Write and schedule posts for Redial's LinkedIn, Facebook and Instagram. Agents can draft and schedule; publishing right away from Claude or ChatGPT asks you first.">
      <SocialView accounts={accounts} posts={(posts ?? []) as SocialPost[]} setup={setup} notice={notice}
        ready={{ linkedin: Boolean(keys.LINKEDIN_CLIENT_ID), meta: Boolean(keys.META_APP_ID) }} canSettings={can(staff, "settings.manage")} />
    </AdminPage>
  );
}
