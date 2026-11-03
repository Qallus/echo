import { AdminPage, Section } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { MODELS } from "@/lib/ai/models";
import { isConfigured } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";
import { getTranscriptionSetting } from "@/lib/transcription/run";
import { TranscriptionSettingForm } from "./transcription-setting";

export const metadata = { title: "AI · Admin · Echo" };

type McpRow = { tool: string; user_email: string | null; calls: number; errors: number; last_at: string };

// AI: providers, transcription and MCP connector usage. Model defaults,
// customer keys, local models and cost tracking join here in step S3.
export default async function AdminAiPage() {
  const staff = await requireStaff("ai.view");
  const supabase = await createClient();
  const [transcription, mcp] = await Promise.all([getTranscriptionSetting(supabase), supabase.rpc("admin_mcp_usage", { days: 30 })]);
  const keys = { openai: Boolean(process.env.OPENAI_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY) };
  const rows = (mcp.data ?? []) as McpRow[];
  const byTool = Object.values(rows.reduce<Record<string, { tool: string; calls: number; errors: number }>>((acc, r) => {
    acc[r.tool] ??= { tool: r.tool, calls: 0, errors: 0 };
    acc[r.tool].calls += Number(r.calls);
    acc[r.tool].errors += Number(r.errors);
    return acc;
  }, {})).sort((a, b) => b.calls - a.calls);

  return (
    <AdminPage title="AI" description="Which AI services Echo uses, and how the Echo connector is being used.">
      <Tabs defaultValue="providers">
        <TabsList variant="line">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="mcp">MCP usage</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="pt-6">
          <Section title="Providers" description="Echo's own keys, set in Coolify. Customers' own keys come in the next step.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODELS.map((m) => {
                const on = isConfigured(m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.vendor}</p>
                    </div>
                    <span className={on ? "text-xs font-medium text-emerald-600 dark:text-emerald-400" : "text-xs text-muted-foreground"}>{on ? "Key set" : "No key"}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="transcription" className="pt-6">
          <Section title="Transcription" description="Which service turns recordings into transcripts, for every workspace.">
            <TranscriptionSettingForm current={transcription} keys={keys} readOnly={!can(staff, "ai.manage")} />
          </Section>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-6 pt-6">
          <Section title="Echo connector, last 30 days" description="Tool calls from Claude and other AI apps through the Echo MCP connector.">
            {byTool.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No connector calls in the last 30 days.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {byTool.map((t) => (
                  <div key={t.tool} className="rounded-xl border p-4">
                    <code className="text-xs">{t.tool}</code>
                    <p className="text-xl font-semibold tabular-nums">{t.calls}</p>
                    {t.errors > 0 && <p className="text-xs text-destructive">{t.errors} failed</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
          {rows.length > 0 && (
            <Section title="By user">
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Tool</TableHead><TableHead className="text-right">Calls</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>Last</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
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
