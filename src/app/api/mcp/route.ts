import { createMcpHandler } from "@modelcontextprotocol/server";
import { contextFromAuth, rateLimited, verifyBearer } from "@/lib/mcp/auth";
import { createEchoServer } from "@/lib/mcp/server";
import { CORS_HEADERS, resourceMetadataUrl } from "@/lib/mcp/urls";

// Remote MCP endpoint (Streamable HTTP, stateless). Auth: Supabase OAuth access
// token as a Bearer header; discovery via /.well-known/oauth-protected-resource.
const handler = createMcpHandler(({ authInfo }) => createEchoServer(contextFromAuth(authInfo)), {
  onerror: (error) => console.error("[mcp]", error.message),
});

function withCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function unauthorized(req: Request) {
  const hadToken = req.headers.has("authorization");
  const challenge = `Bearer resource_metadata="${resourceMetadataUrl(req)}"${hadToken ? ', error="invalid_token"' : ""}`;
  return withCors(
    Response.json(
      { error: hadToken ? "invalid_token" : "unauthorized", error_description: "Sign in to Echo to use this connector." },
      { status: 401, headers: { "WWW-Authenticate": challenge } },
    ),
  );
}

async function handle(req: Request) {
  const authInfo = await verifyBearer(req);
  if (!authInfo) return unauthorized(req);

  const retryAfter = rateLimited(authInfo.extra!.userId as string);
  if (retryAfter) {
    return withCors(
      Response.json(
        { error: "rate_limited", error_description: `Too many Echo calls. Try again in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    );
  }
  return withCors(await handler.fetch(req, { authInfo }));
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { handle as GET, handle as POST, handle as DELETE };
