import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Allow / Deny from /oauth/consent. Supabase returns the client's redirect_url
// (with ?code= on approve, ?error=access_denied on deny).
export async function POST(req: NextRequest) {
  // Same-origin form posts only.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return new NextResponse("Forbidden", { status: 403 });

  const form = await req.formData();
  const id = String(form.get("authorization_id") ?? "");
  const decision = form.get("decision");
  if (!id || (decision !== "approve" && decision !== "deny")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });

  // Expired or already used: the consent page explains it.
  const dest = error || !data ? new URL(`/oauth/consent?authorization_id=${encodeURIComponent(id)}`, req.url) : data.redirect_url;
  return NextResponse.redirect(dest, { status: 303 });
}
