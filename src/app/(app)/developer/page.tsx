import Link from "next/link";
import { CircleAlert, CircleCheck, Plug, Smartphone, SquareTerminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { RevokeButton } from "./revoke-button";

export const metadata = { title: "Developer · Echo" };

const PRODUCTION_MCP = "https://echo.redial.si/api/mcp";

export default async function DeveloperPage() {
  await requireUser();
  const supabase = await createClient();
  const origin = await siteOrigin();
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);
  const mcpUrl = isLocal ? PRODUCTION_MCP : `${origin}/api/mcp`;

  const [activity, grants] = await Promise.all([
    supabase.from("mcp_audit_log").select("id, created_at, client_id, tool, target_id, ok, error")
      .order("created_at", { ascending: false }).limit(50),
    supabase.auth.oauth.listGrants(),
  ]);
  const apps = grants.data ?? [];
  const appName = (clientId: string | null) =>
    (clientId && apps.find((g) => g.client.id === clientId)?.client.name) || (clientId ? "Connected app" : "Direct");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Developer</h1>
        <p className="text-sm text-muted-foreground">
          Connect Claude to Echo, see what connected apps did, and disconnect them. Backlog items you add from Claude
          land in <Link href="/backlog" className="underline">Backlog</Link>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="size-4" /> Echo connector (MCP)</CardTitle>
          <CardDescription>Gives Claude (web, desktop, phone) and Claude Code the same access you have in Echo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="flex-1 truncate text-sm">{mcpUrl}</code>
            <CopyButton value={mcpUrl} label="Copy URL" />
          </div>
          {isLocal && (
            <p className="text-xs text-muted-foreground">
              Claude connects from the internet, so use the production address once Echo is live at echo.redial.si.
              For local testing: <code>{origin}/api/mcp</code>.
            </p>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <h3 className="flex items-center gap-2 font-medium"><Smartphone className="size-4" /> Claude (web and phone)</h3>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>On claude.ai: Customize → Connectors → <span className="text-foreground">Add custom connector</span>.</li>
                <li>Name <span className="text-foreground">Echo</span>, URL above. Authentication: sign in when needed, register automatically.</li>
                <li>Click Connect, sign in to Echo, then <span className="text-foreground">Allow</span>.</li>
                <li>On your phone, in a chat: + → Connectors → turn on Echo.</li>
              </ol>
            </div>
            <div className="space-y-2 text-sm">
              <h3 className="flex items-center gap-2 font-medium"><SquareTerminal className="size-4" /> Claude Code</h3>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <code className="flex-1 truncate text-xs">claude mcp add --transport http echo {mcpUrl}</code>
                <CopyButton value={`claude mcp add --transport http echo ${mcpUrl}`} />
              </div>
              <p className="text-muted-foreground">Then run <code>/mcp</code> in Claude Code and sign in.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected apps</CardTitle>
          <CardDescription>Apps you allowed on the Echo consent screen. Disconnecting signs them out right away.</CardDescription>
        </CardHeader>
        <CardContent>
          {grants.error ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load connected apps: {grants.error.message}</p>
          ) : apps.length ? (
            <ul className="divide-y rounded-lg border">
              {apps.map((g) => (
                <li key={g.client.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{g.client.name || "Unnamed app"}</div>
                    <div className="text-xs text-muted-foreground">
                      Allowed <LocalDate iso={g.granted_at} short />{g.scopes.length ? ` · ${g.scopes.join(", ")}` : ""}
                    </div>
                  </div>
                  <RevokeButton clientId={g.client.id} name={g.client.name || "this app"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No apps connected yet.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <p className="text-sm text-muted-foreground">Your last 50 connector calls.</p>
        </div>
        {activity.data?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Time</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead className="w-24">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground"><LocalDate iso={a.created_at} /></TableCell>
                  <TableCell>{appName(a.client_id)}</TableCell>
                  <TableCell><code className="text-xs">{a.tool}</code></TableCell>
                  <TableCell>
                    {a.ok
                      ? <span className="inline-flex items-center gap-1 text-xs text-sky-600"><CircleCheck className="size-3.5" /> OK</span>
                      : <span title={a.error ?? undefined} className="inline-flex items-center gap-1 text-xs text-destructive"><CircleAlert className="size-3.5" /> Failed</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No connector activity yet. Connect Claude above and ask it something about your recordings.
          </p>
        )}
      </section>
    </div>
  );
}
