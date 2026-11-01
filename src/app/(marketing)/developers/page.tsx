import Link from "next/link";
import { Bot, Braces, Gauge, KeyRound, Plug, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Developers · Echo API, webhooks and Claude connector",
  description: "Pipe Echo recordings, transcripts, summaries and action items into your own platform with the Echo REST API, webhooks and the MCP connector for Claude.",
  alternates: { canonical: "/developers" },
};

const SITE = "https://echo.redial.si";
const MCP_URL = `${SITE}/api/mcp`;
const API_BASE = `${SITE}/api/v1`;

const TOOLS: { group: string; tools: [string, string][] }[] = [
  { group: "Account", tools: [["echo_whoami", "Signed-in user, workspaces and role"], ["echo_workspace_list", "Workspaces you belong to"], ["echo_workspace_update", "Rename a workspace (owner/admin)"], ["echo_member_list", "Members and roles"]] },
  { group: "Recordings", tools: [["echo_recording_list", "List and filter (view, folder, source, status, paging)"], ["echo_recording_get", "One recording with summary, action items, highlights; transcript paged"], ["echo_recording_create", "Create a recording, optionally with a pasted transcript"], ["echo_recording_update", "Edit title, folder, status, or move between workspaces"], ["echo_recording_purge", "Permanently delete a trashed recording"], ["echo_search", "Full-text search across titles, transcripts and summaries"]] },
  { group: "Folders", tools: [["echo_folder_list", "Folders with recording counts"], ["echo_folder_create", "New folder"], ["echo_folder_update", "Rename"], ["echo_folder_delete", "Delete (recordings become Unfiled)"]] },
  { group: "Transcript & highlights", tools: [["echo_transcript_replace", "Replace all segments"], ["echo_segment_update", "Fix one segment"], ["echo_segment_delete", "Remove one segment"], ["echo_highlight_create / _update / _delete", "Manage highlights"]] },
  { group: "Summaries & action items", tools: [["echo_summary_upsert", "Create or replace a summary"], ["echo_summary_delete", "Remove a summary"], ["echo_action_item_list", "List action items"], ["echo_action_item_create / _update / _delete", "Manage action items"]] },
  { group: "Backlog & activity", tools: [["echo_dev_request_list / _get / _create / _update / _comment / _delete", "Developer backlog"], ["echo_audit_log_list", "What connected apps did"]] },
];

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/recordings", "List recordings (filters: workspace_id, folder_id, status, source, updated_since; cursor paging)"],
  ["POST", "/recordings", "Create a recording from an audio URL or a transcript"],
  ["GET", "/recordings/{id}", "Recording with summary, action items and highlights"],
  ["GET", "/recordings/{id}/transcript", "Speaker-labelled segments (JSON, TXT, SRT or VTT)"],
  ["PATCH", "/recordings/{id}", "Update title, folder or workspace"],
  ["DELETE", "/recordings/{id}", "Move to Trash"],
  ["GET", "/recordings/{id}/summary", "Summary: overview, key points, mind map"],
  ["GET", "/action-items", "Action items across recordings (filter: done, owner)"],
  ["PATCH", "/action-items/{id}", "Mark done or edit"],
  ["GET", "/search?q=", "Full-text search"],
  ["GET", "/workspaces", "Workspaces the key can access"],
  ["GET / POST / DELETE", "/webhooks", "Manage webhook endpoints"],
];

const EVENTS: [string, string][] = [
  ["recording.created", "A recording was saved (browser, upload or API)"],
  ["transcript.ready", "Transcription finished"],
  ["transcript.failed", "Transcription failed (includes the reason)"],
  ["summary.ready", "A summary was created or replaced"],
  ["action_item.created", "A new action item was extracted or added"],
  ["action_item.completed", "An action item was marked done"],
  ["share.viewed", "Someone opened a share link"],
];

const CURL = `curl ${API_BASE}/recordings?limit=2 \\
  -H "Authorization: Bearer echo_sk_live_..."`;

const RESPONSE = `{
  "data": [
    {
      "id": "8f1c…",
      "title": "Launch plan review",
      "workspace_id": "2b7e…",
      "source": "meeting",
      "status": "generated",
      "duration_sec": 842,
      "created_at": "2026-10-30T17:24:00Z",
      "summary": { "overview": "Budget approved. Launch on Friday…" }
    }
  ],
  "next_cursor": "eyJjcmVhdGVkX2F0Ijoi…"
}`;

const VERIFY = `import crypto from "node:crypto";

// Header: Echo-Signature: t=1793420000,v1=<hex hmac>
export function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 min tolerance
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`;

const EVENT_BODY = `{
  "id": "evt_01J…",
  "type": "transcript.ready",
  "created_at": "2026-10-31T05:12:53Z",
  "workspace_id": "2b7e…",
  "data": { "recording_id": "8f1c…", "title": "Launch plan review", "url": "${SITE}/recordings/8f1c…" }
}`;

function Code({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-neutral-950 text-neutral-100">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-xs text-neutral-400">{label}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

function Section({ id, icon: Icon, title, intro, children }: { id: string; icon: typeof Plug; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5 border-t py-14">
      <div className="max-w-2xl space-y-2">
        <Icon className="size-5" />
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground">{intro}</p>
      </div>
      {children}
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="py-16 sm:py-24">
        <p className="text-sm font-medium text-muted-foreground">Developers</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Pipe every conversation into the tools you already use</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Recordings, transcripts, summaries and action items from your Echo subscription, available to your platform through a REST API, real-time webhooks and an MCP connector for Claude.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/developer" />}><KeyRound /> Get an API key</Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#api" />}>Read the API reference</Button>
        </div>
        <nav className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "#mcp", icon: Bot, title: "Claude connector", desc: "MCP server with OAuth" },
            { href: "#api", icon: Braces, title: "REST API", desc: "JSON over HTTPS" },
            { href: "#webhooks", icon: Webhook, title: "Webhooks", desc: "Signed, retried events" },
            { href: "#limits", icon: Gauge, title: "Limits", desc: "Rate limits and errors" },
          ].map(({ href, icon: Icon, title, desc }) => (
            <a key={href} href={href} className="rounded-xl border p-4 hover:bg-muted/40">
              <Icon className="mb-2 size-5" />
              <div className="font-medium">{title}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </a>
          ))}
        </nav>
      </header>

      <Section id="mcp" icon={Bot} title="Claude connector (MCP)" intro="Give Claude on the web, desktop and phone, and Claude Code, the same access you have in Echo. Every tool call is checked against your permissions and logged.">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3">
          <code className="flex-1 truncate text-sm">{MCP_URL}</code>
          <CopyButton value={MCP_URL} label="Copy URL" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <h3 className="font-medium">Claude (web and phone)</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Customize → Connectors → Add custom connector.</li>
              <li>Name it Echo and paste the URL above.</li>
              <li>Connect, sign in to Echo, and click Allow.</li>
            </ol>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="font-medium">Claude Code</h3>
            <Code label="terminal" code={`claude mcp add --transport http echo ${MCP_URL}`} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Authentication is OAuth 2.1 with dynamic client registration. Discovery: <code>{SITE}/.well-known/oauth-protected-resource</code>. Tokens carry your identity, so a connected app can never see more than you can.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {TOOLS.map((g) => (
            <div key={g.group} className="rounded-xl border">
              <div className="border-b px-4 py-2 text-sm font-medium">{g.group}</div>
              <ul className="divide-y text-sm">
                {g.tools.map(([name, desc]) => (
                  <li key={name} className="px-4 py-2"><code className="text-[13px]">{name}</code><div className="text-xs text-muted-foreground">{desc}</div></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="api" icon={Braces} title="REST API" intro="A JSON API for syncing Echo data into CRMs, data warehouses, help desks and internal tools. Keys are created per workspace and can be limited to read-only.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">Base URL</span> <code>{API_BASE}</code></p>
            <p><span className="font-medium">Authentication</span> Send your key as a bearer token: <code>Authorization: Bearer echo_sk_…</code>. Create and revoke keys on the Developer page in Echo.</p>
            <p><span className="font-medium">Paging</span> List endpoints return <code>next_cursor</code>; pass it back as <code>?cursor=</code>.</p>
            <p><span className="font-medium">Errors</span> Standard HTTP codes with <code>{`{ "error": { "code", "message" } }`}</code>.</p>
          </div>
          <div className="space-y-3">
            <Code label="request" code={CURL} />
            <Code label="response" code={RESPONSE} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="px-4 py-2 font-medium">Method</th><th className="px-4 py-2 font-medium">Path</th><th className="px-4 py-2 font-medium">Description</th></tr></thead>
            <tbody className="divide-y">
              {ENDPOINTS.map(([m, p, d]) => (
                <tr key={m + p}><td className="px-4 py-2 font-mono text-xs">{m}</td><td className="px-4 py-2 font-mono text-xs">{p}</td><td className="px-4 py-2 text-muted-foreground">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="webhooks" icon={Webhook} title="Webhooks" intro="Get an HTTPS POST the moment something happens, instead of polling. Deliveries are signed, retried with backoff for up to 24 hours, and logged so you can replay them.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr><th className="px-4 py-2 font-medium">Event</th><th className="px-4 py-2 font-medium">When</th></tr></thead>
              <tbody className="divide-y">
                {EVENTS.map(([e, d]) => <tr key={e}><td className="px-4 py-2 font-mono text-xs">{e}</td><td className="px-4 py-2 text-muted-foreground">{d}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="space-y-3">
            <Code label="event body" code={EVENT_BODY} />
            <Code label="verify the signature (Node.js)" code={VERIFY} />
          </div>
        </div>
      </Section>

      <Section id="limits" icon={Gauge} title="Limits" intro="Generous by default, and higher on Business plans. Responses include RateLimit headers so clients can slow down before they're throttled.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Claude connector", "120 tool calls per user per minute"],
            ["REST API", "Per key: 60 requests/min (Pro), 600/min (Business)"],
            ["Webhooks", "Up to 10 endpoints per workspace"],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border p-4"><div className="font-medium">{t}</div><div className="text-sm text-muted-foreground">{d}</div></div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Over the limit you get <code>429 Too Many Requests</code> with a <code>Retry-After</code> header. Questions or higher limits: <a href={`mailto:${COMPANY.email}`} className="underline">{COMPANY.email}</a>.</p>
      </Section>
    </div>
  );
}
