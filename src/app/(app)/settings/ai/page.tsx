import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODELS } from "@/lib/ai/models";
import { echoModelName } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/ai/settings";
import { listWorkspaces, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { KeysCard, type KeyRow } from "./keys-card";
import { ScopeSwitch } from "./scope-switch";

export const metadata = { title: "AI models · Settings · Echo" };

// Customers' own AI keys: yours (Personal workspace, and Business workspaces
// set to "each person") and, for owners/admins, each Business workspace's keys.
// If a key stops working, Echo falls back to its own keys and lets you know.
export default async function AiSettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [workspaces, settings, keysRes, scopesRes] = await Promise.all([
    listWorkspaces(),
    getAiSettings(supabase),
    supabase.from("ai_keys").select("id, scope, workspace_id, user_id, provider, last4, model, status, last_error"),
    supabase.from("workspaces").select("id, ai_key_scope").eq("is_personal", false),
  ]);
  const keys = (keysRes.data ?? []) as (KeyRow & { scope: string; workspace_id: string | null; user_id: string | null })[];
  const scopes = new Map((scopesRes.data ?? []).map((w) => [w.id, w.ai_key_scope as "workspace" | "member"]));
  const defaults = Object.fromEntries(MODELS.map((m) => [m.id, echoModelName(m.id, settings)]));
  const business = workspaces.filter((w) => !w.isPersonal);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
          <CardDescription>
            Use your own AI accounts for Ask Echo, summaries and (with an OpenAI key) transcription. Used in your Personal workspace and in Business
            workspaces set to &ldquo;each person&apos;s own keys.&rdquo; If a key stops working, Echo uses its own keys and tells you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeysCard scope="user" keys={keys.filter((k) => k.scope === "user" && k.user_id === user.id)} canEdit defaults={defaults} />
        </CardContent>
      </Card>

      {business.map((w) => {
        const scope = scopes.get(w.id) ?? "workspace";
        const manage = w.role === "owner" || w.role === "admin";
        return (
          <Card key={w.id}>
            <CardHeader>
              <CardTitle>{w.name}</CardTitle>
              <CardDescription>
                {scope === "workspace"
                  ? manage ? "Keys for everyone in this workspace." : "This workspace uses the team's keys, managed by its owners and admins."
                  : "Each person uses their own keys here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {w.role === "owner" && <ScopeSwitch workspaceId={w.id} value={scope} />}
              {scope === "workspace" && (manage || keys.some((k) => k.workspace_id === w.id)) && (
                <KeysCard scope="workspace" workspaceId={w.id} keys={keys.filter((k) => k.scope === "workspace" && k.workspace_id === w.id)}
                  canEdit={manage} defaults={defaults} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
