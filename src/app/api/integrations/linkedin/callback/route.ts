import { type NextRequest } from "next/server";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { encryptKey } from "@/lib/ai/keys";
import { linkedinAccounts, linkedinKeys, linkedinToken } from "@/lib/social/linkedin";
import { backToSocial, socialCookie } from "@/lib/social/oauth-state";
import { createClient } from "@/lib/supabase/server";

// LinkedIn sends people back here: check the state, swap the code for a
// token, and save the profile (and company pages, when approved) as
// accounts Redial can post as. Tokens are stored encrypted.
export async function GET(req: NextRequest) {
  await requireStaff("social.manage");
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return backToSocial("error=linkedin_denied", "linkedin");
  const state = req.cookies.get(socialCookie("linkedin"))?.value;
  const code = p.get("code");
  if (!code || !state || p.get("state") !== state) return backToSocial("error=linkedin_state", "linkedin");
  try {
    const keys = await linkedinKeys();
    if (!keys) return backToSocial("error=linkedin_not_configured", "linkedin");
    const t = await linkedinToken(code);
    const accounts = await linkedinAccounts(t.accessToken, keys.pages, keys.version);
    const supabase = await createClient();
    const expires = new Date(Date.now() + t.expiresIn * 1000).toISOString();
    for (const a of accounts) {
      const row = {
        provider: "linkedin", kind: a.kind, external_id: a.externalId, name: a.name, picture: a.picture,
        access_token: encryptKey(t.accessToken), refresh_token: t.refreshToken ? encryptKey(t.refreshToken) : null,
        expires_at: expires, scopes: t.scopes.slice(0, 40), status: "active", last_error: null,
      };
      const { data: existing } = await supabase.from("social_accounts").select("id").eq("provider", "linkedin").eq("external_id", a.externalId).maybeSingle();
      const w = existing
        ? await supabase.from("social_accounts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await supabase.from("social_accounts").insert(row);
      if (w.error) throw new Error(w.error.message);
    }
    await adminAudit(supabase, "social.connect", { type: "social_account", id: "linkedin" }, { provider: "linkedin", accounts: accounts.length });
    return backToSocial(`connected=linkedin&count=${accounts.length}`, "linkedin");
  } catch (e) {
    console.error("[linkedin-oauth]", e instanceof Error ? e.message : e);
    return backToSocial("error=linkedin_failed", "linkedin");
  }
}
