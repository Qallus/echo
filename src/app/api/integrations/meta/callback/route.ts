import { type NextRequest } from "next/server";
import { adminAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/guard";
import { encryptKey } from "@/lib/ai/keys";
import { metaAccounts } from "@/lib/social/meta";
import { backToSocial, socialCookie } from "@/lib/social/oauth-state";
import { createClient } from "@/lib/supabase/server";

// Facebook sends people back here: check the state, get the Pages (and
// linked Instagram accounts) with their page tokens, and save them encrypted.
export async function GET(req: NextRequest) {
  await requireStaff("social.manage");
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return backToSocial("error=meta_denied", "meta");
  const state = req.cookies.get(socialCookie("meta"))?.value;
  const code = p.get("code");
  if (!code || !state || p.get("state") !== state) return backToSocial("error=meta_state", "meta");
  try {
    const accounts = await metaAccounts(code);
    const supabase = await createClient();
    for (const a of accounts) {
      const row = { provider: a.provider, kind: "page", external_id: a.externalId, name: a.name, picture: a.picture, access_token: encryptKey(a.token), expires_at: null, status: "active", last_error: null };
      const { data: existing } = await supabase.from("social_accounts").select("id").eq("provider", a.provider).eq("external_id", a.externalId).maybeSingle();
      const w = existing
        ? await supabase.from("social_accounts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await supabase.from("social_accounts").insert(row);
      if (w.error) throw new Error(w.error.message);
    }
    await adminAudit(supabase, "social.connect", { type: "social_account", id: "meta" }, { provider: "meta", accounts: accounts.length });
    return backToSocial(accounts.length ? `connected=meta&count=${accounts.length}` : "error=meta_no_pages", "meta");
  } catch (e) {
    console.error("[meta-oauth]", e instanceof Error ? e.message : e);
    return backToSocial("error=meta_failed", "meta");
  }
}
