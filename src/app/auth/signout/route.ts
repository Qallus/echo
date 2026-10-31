import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/mcp/urls";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/login", siteOrigin(req)), { status: 303 });
}
