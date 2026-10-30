import { authorizationServer, CORS_HEADERS, mcpResource } from "@/lib/mcp/urls";

// RFC 9728 protected resource metadata: tells MCP clients that /api/mcp is
// protected by Supabase Auth's OAuth 2.1 server.
export function GET(req: Request) {
  return Response.json(
    {
      resource: mcpResource(req),
      authorization_servers: [authorizationServer()],
      bearer_methods_supported: ["header"],
      resource_name: "Echo",
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
