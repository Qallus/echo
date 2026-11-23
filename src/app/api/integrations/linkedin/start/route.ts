import { requireStaff } from "@/lib/admin/guard";
import { linkedinAuthUrl, linkedinKeys } from "@/lib/social/linkedin";
import { backToSocial, newState, withState } from "@/lib/social/oauth-state";

// Admin -> Social -> Connect LinkedIn (social.manage).
export async function GET() {
  await requireStaff("social.manage");
  const keys = await linkedinKeys();
  if (!keys) return backToSocial("error=linkedin_not_configured");
  const state = newState();
  return withState(await linkedinAuthUrl(keys.id, keys.pages, state), "linkedin", state);
}
