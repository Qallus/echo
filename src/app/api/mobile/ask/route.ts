import { POST as chat } from "@/app/api/chat/route";
import { mobileBearer } from "@/lib/mobile/auth";
import { runAsMobile } from "@/lib/mobile/context";

// Ask Echo from the Redial app: the web's chat route (same body, same plain
// text stream), run as the member whose token this is.
export async function POST(req: Request) {
  const token = await mobileBearer(req);
  if (!token) return Response.json({ error: "Sign in again." }, { status: 401 });
  return runAsMobile(token, () => chat(req));
}
