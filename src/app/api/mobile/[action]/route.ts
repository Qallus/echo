import type { NextRequest } from "next/server";
import { mobileBearer } from "@/lib/mobile/auth";
import { runAsMobile } from "@/lib/mobile/context";
import { ROUTES } from "@/lib/mobile/routes";

// The Redial app's API. GET /api/mobile/<name>?… for reads, POST with a JSON
// body for actions (the list is in src/lib/mobile/routes.ts). Every request
// carries the member's access token; responses are JSON, and a result with
// an `error` field comes back as 400.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function handle(req: NextRequest, action: string, method: "GET" | "POST") {
  const route = Object.hasOwn(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) return json({ error: "Not found." }, 404);
  if (route.method !== method) return json({ error: `Use ${route.method}.` }, 405);
  const token = await mobileBearer(req);
  if (!token) return json({ error: "Sign in again." }, 401);

  const raw = method === "GET"
    ? Object.fromEntries(req.nextUrl.searchParams)
    : await req.json().catch(() => undefined);
  const input = route.input.safeParse(raw ?? {});
  if (!input.success) return json({ error: "Invalid request.", issues: input.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);

  return runAsMobile(token, async () => {
    try {
      const result = await route.run(input.data as never);
      const failed = !!result && typeof result === "object" && "error" in result && (result as { error?: unknown }).error;
      return json(result ?? { ok: true }, failed ? 400 : 200);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Something went wrong." }, 400);
    }
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  return handle(req, (await params).action, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  return handle(req, (await params).action, "POST");
}
