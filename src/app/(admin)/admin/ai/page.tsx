import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { MODELS } from "@/lib/ai/models";
import { configuredProviders, echoModelName } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { createClient } from "@/lib/supabase/server";
import { getTranscriptionSetting } from "@/lib/transcription/run";
import { AiSettingsForm } from "./ai-settings-form";
import { CustomProviders, type CustomProvider } from "./custom-providers";
import { TranscriptionSettingForm } from "./transcription-setting";

export const metadata = { title: "AI · Admin · Echo" };

type McpRow = { tool: string; user_email: string | null; calls: number; errors: number; last_at: string };
type Usage = {
  totals: { calls: number; failed: number; fallbacks: number; cost_cents: number; echo_cost_cents: number; own_cost_cents: number };
  by_model: { provider: string; model: string | null; feature: string; key_source: string; calls: number; failed: number; input_tokens: number; output_tokens: number; audio_seconds: number; cost_cents: number; avg_latency_ms: number | null }[];
  by_workspace: { workspace_id: string | null; name: string | null; is_personal: boolean | null; owner_email: string | null; calls: number; cost_cents: number; own_key_calls: number }[];
};
type KeyCount = { provider: string; scope: string; ok: number; failed: number };

const dollars = (cents: number) => `$${(Number(cents) / 100).toFixed(2)}`;
const providerLabel = (p: string) => MODELS.find((m) => m.id === p)?.label ?? (p.startsWith("custom:") ? "Custom" : p);

// AI: which models customers get with Echo's keys, custom/local providers,
// transcription, usage and cost (Echo's keys vs customers' own), customer key
// health and Echo connector (MCP) usage.
export default async function AdminAiPage() {
  const staff = await requireStaff("ai.view");
  const manage = can(staff, "ai.manage");
  const supabase = await createClient();
  const [settings, transcription, mcp, usage, keyCounts, custom] = await Promise.all([
    getAiSettings(supabase),
    getTranscriptionSetting(supabase),
    supabase.rpc("admin_mcp_usage", { days: 30 }),
    supabase.rpc("admin_ai_usage", { days: 30 }),
    supabase.rpc("admin_ai_keys_overview"),
    supabase.from("ai_custom_providers").select("id, name, base_url, model, last4, enabled").order("created_at"),
  ]);
  const configured = await configuredProviders();
  const defaults = Object.fromEntries(MODELS.map((m) => [m.id, echoModelName(m.id, { ...settings, models: {} })]));
  const transcriptionKeys = { openai: configured.gpt, gemini: configured.gemini };
  const u = usage.data as Usage | null;
  const mcpRows = (mcp.data ?? []) as McpRow[];
  const mcpByTool = Object.values(mcpRows.reduce<Record<string, { tool: string; calls: number; errors: number }>>((acc, r) => {
    acc[r.tool] ??= { tool: r.tool, calls: 0, errors: 0 };
    acc[r.tool].calls += Number(r.calls);
    acc[r.tool].errors += Number(r.errors);
    return acc;
  }, {})).sort((a, b) => b.calls - a.calls);

  return (
    <AdminPage title="AI" description="Models, keys, custom providers, transcription and what it all costs.">
      <Tabs defaultValue="models">
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="custom">Custom providers</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="usage">Usage &amp; cost</TabsTrigger>
          <TabsTrigger value="keys">Customer keys</TabsTrigger>
          <TabsTrigger value="mcp">MCP usage</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="pt-6">
          <AiSettingsForm initial={settings} configured={configured} defaults={defaults} readOnly={!manage} />
        </TabsContent>

        <TabsContent value="custom" className="pt-6">
          <Section title="Custom providers" description="Any OpenAI-compatible endpoint, including a model running on your own server. Enabled ones appear in customers' model lists.">
            <CustomProviders providers={(custom.data ?? []) as CustomProvider[]} readOnly={!manage} />
          </Section>
        </TabsContent>

        <TabsContent value="transcription" className="pt-6">
          <Section title="Transcription" description="Which service turns recordings into transcripts. Customers' own OpenAI keys are used first when they've added one.">
            <TranscriptionSettingForm current={transcription} keys={transcriptionKeys} readOnly={!manage} />
          </Section>
        </TabsContent>

        <TabsContent value="usage" className="space-y-8 pt-6">
          {!u ? <p className="text-sm text-muted-foreground">No usage data.</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="AI calls (30 days)" value={u.totals.calls} hint={`${u.totals.failed} failed`} />
                <StatCard label="Estimated spend on Echo's keys" value={dollars(u.totals.echo_cost_cents)} />
                <StatCard label="On customers' own keys" value={dollars(u.totals.own_cost_cents)} hint="Billed to them, not Echo" />
                <StatCard label="Fallbacks to Echo's keys" value={u.totals.fallbacks} hint="A customer key failed" />
              </div>
              <Section title="By model and feature">
                {u.by_model.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No AI calls in the last 30 days.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Model</TableHead><TableHead>Feature</TableHead><TableHead>Key</TableHead>
                      <TableHead className="text-right">Calls</TableHead><TableHead className="text-right">Tokens in / out</TableHead>
                      <TableHead className="text-right">Avg time</TableHead><TableHead className="text-right">Est. cost</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {u.by_model.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell><span className="font-medium">{providerLabel(r.provider)}</span> <code className="text-xs text-muted-foreground">{r.model}</code></TableCell>
                          <TableCell>{r.feature}</TableCell>
                          <TableCell><Badge variant="outline">{r.key_source === "own" ? "Customer" : r.key_source === "custom" ? "Custom" : "Echo"}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">{r.calls}{r.failed > 0 && <span className="text-destructive"> ({r.failed} failed)</span>}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{r.audio_seconds ? `${Math.round(r.audio_seconds / 60)} min audio` : `${r.input_tokens.toLocaleString()} / ${r.output_tokens.toLocaleString()}`}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{r.avg_latency_ms ? `${(r.avg_latency_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{dollars(r.cost_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
              {u.by_workspace.length > 0 && (
                <Section title="Top workspaces by spend">
                  <Table>
                    <TableHeader><TableRow><TableHead>Workspace</TableHead><TableHead>Owner</TableHead><TableHead className="text-right">Calls</TableHead><TableHead className="text-right">On own keys</TableHead><TableHead className="text-right">Est. cost</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {u.by_workspace.map((w, i) => (
                        <TableRow key={i}>
                          <TableCell>{w.workspace_id ? (w.is_personal ? "Personal" : w.name) : "Library (no workspace)"}</TableCell>
                          <TableCell className="text-muted-foreground">{w.owner_email ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{w.calls}</TableCell>
                          <TableCell className="text-right tabular-nums">{w.own_key_calls}</TableCell>
                          <TableCell className="text-right tabular-nums">{dollars(w.cost_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="keys" className="pt-6">
          <Section title="Customer keys" description="How many customers use their own keys, and whether they work. Keys themselves are encrypted and never shown.">
            {((keyCounts.data ?? []) as KeyCount[]).length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No customer keys yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Working</TableHead><TableHead className="text-right">Failing</TableHead></TableRow></TableHeader>
                <TableBody>
                  {((keyCounts.data ?? []) as KeyCount[]).map((k, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{providerLabel(k.provider)}</TableCell>
                      <TableCell>{k.scope === "workspace" ? "Team" : "Personal"}</TableCell>
                      <TableCell className="text-right tabular-nums">{k.ok}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(k.failed) > 0 ? <span className="text-destructive">{k.failed}</span> : 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-6 pt-6">
          <Section title="Echo connector, last 30 days" description="Tool calls from Claude and other AI apps through the Echo MCP connector.">
            {mcpByTool.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No connector calls in the last 30 days.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {mcpByTool.map((t) => (
                  <div key={t.tool} className="rounded-xl border p-4">
                    <code className="text-xs">{t.tool}</code>
                    <p className="text-xl font-semibold tabular-nums">{t.calls}</p>
                    {t.errors > 0 && <p className="text-xs text-destructive">{t.errors} failed</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
          {mcpRows.length > 0 && (
            <Section title="By user">
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Tool</TableHead><TableHead className="text-right">Calls</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>Last</TableHead></TableRow></TableHeader>
                <TableBody>
                  {mcpRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.user_email ?? "—"}</TableCell>
                      <TableCell><code className="text-xs">{r.tool}</code></TableCell>
                      <TableCell className="text-right tabular-nums">{r.calls}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.errors}</TableCell>
                      <TableCell className="text-muted-foreground"><LocalDate iso={r.last_at} short /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
