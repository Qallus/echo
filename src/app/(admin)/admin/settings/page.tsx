import { AdminPage } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { SECRET_KEYS } from "@/lib/integrations";
import { sources } from "@/lib/secrets";
import { Integrations, type KeyState } from "./integrations";
import { MfaSwitch } from "./mfa-switch";
import { OrganizationForm } from "./organization-form";
import { readOrg } from "@/lib/settings/organization";

export const metadata = { title: "Settings · Admin · Echo" };

type AuditRow = { id: number; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; detail: Record<string, unknown>; created_at: string };

// Admin settings: organization details, service integrations, staff security
// and the audit log.
export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("audit.view");
  const supabase = await createClient();
  const [{ data, error }, { data: security }, { data: org }] = await Promise.all([
    supabase.rpc("admin_audit_feed", { max_rows: 200 }),
    supabase.from("platform_settings").select("value").eq("key", "admin_security").maybeSingle(),
    supabase.from("platform_settings").select("value").eq("key", "organization").maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const rows = data as AuditRow[];
  const manage = can(staff, "settings.manage");
  const { tab } = await searchParams;
  let keyState: Record<string, KeyState> = {};
  if (manage) {
    const keys = [...SECRET_KEYS];
    const [{ data: saved }, from] = await Promise.all([supabase.from("platform_secrets").select("key, hint, updated_at"), sources(keys)]);
    keyState = Object.fromEntries(keys.map((k) => {
      const row = (saved ?? []).find((r) => r.key === k);
      return [k, { hint: row?.hint ?? null, source: from[k], updated_at: row?.updated_at ?? null }];
    }));
  }

  return (
    <AdminPage title="Settings" description="Your organization, service integrations and keys, staff security, and the record of every admin action.">
      <Tabs defaultValue={tab && ["organization", "integrations", "security", "audit"].includes(tab) && (manage || tab !== "integrations") ? tab : "organization"}>
        <TabsList variant="line">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          {manage && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="organization" className="pt-6"><OrganizationForm initial={readOrg(org?.value)} readOnly={!manage} /></TabsContent>
        {manage && <TabsContent value="integrations" className="pt-6"><Integrations state={keyState} readOnly={!manage} /></TabsContent>}
        <TabsContent value="security" className="pt-6">
          <MfaSwitch initial={(security?.value as { requireMfa?: boolean } | null)?.requireMfa !== false} readOnly={!can(staff, "staff.manage")} />
        </TabsContent>
        <TabsContent value="audit" className="pt-6">
          {rows.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No admin actions yet.</p> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground"><LocalDate iso={r.created_at} /></TableCell>
                    <TableCell>{r.actor_email ?? "—"}</TableCell>
                    <TableCell><code className="text-xs">{r.action}</code></TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(r.detail)}>
                      {Object.keys(r.detail ?? {}).length ? JSON.stringify(r.detail) : r.target_type ? `${r.target_type} ${r.target_id ?? ""}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}
