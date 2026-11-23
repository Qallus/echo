import { requireStaff } from "@/lib/admin/guard";
import { metaAuthUrl, metaKeys } from "@/lib/social/meta";
import { backToSocial, newState, withState } from "@/lib/social/oauth-state";

// Admin -> Social -> Connect Facebook (social.manage): Pages and the
// Instagram business accounts linked to them.
export async function GET() {
  await requireStaff("social.manage");
  const keys = await metaKeys();
  if (!keys) return backToSocial("error=meta_not_configured");
  const state = newState();
  return withState(await metaAuthUrl(keys.id, keys.version, state), "meta", state);
}
