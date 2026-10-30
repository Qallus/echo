// Public URLs for the connector. NEXT_PUBLIC_SITE_URL wins so the advertised
// resource matches the domain Claude was given, even behind a proxy.
export function siteOrigin(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

export const mcpResource = (req: Request) => `${siteOrigin(req)}/api/mcp`;
export const resourceMetadataUrl = (req: Request) => `${siteOrigin(req)}/.well-known/oauth-protected-resource`;
export const authorizationServer = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1`;

// Bearer tokens, not cookies, so any origin may call (browser-based MCP clients).
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};
