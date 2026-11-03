import { AdminPage } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, requireStaff } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { MfaSwitch } from "./mfa-switch";

export const metadata = { title: "Settings · Admin · Echo" };

type AuditRow = { id: number; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; detail: Record<string, unknown>; created_at: string };

// Admin settings: the audit log and staff security. Organization, branding,
// integrations and the maintenance banner join in later steps.
export default async function AdminSettingsPage() {
  const staff = await requireStaff("audit.view");
  const supabase = await createClient();
  const [{ data, error }, { data: security }] = await Promise.all([
    supabase.rpc("admin_audit_feed", { max_rows: 200 }),
    supabase.from("platform_settings").select("value").eq("key", "admin_security").maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const rows = data as AuditRow[];

  return (
    <AdminPage title="Settings" description="Platform settings and the record of every admin action.">
      <Tabs defaultValue="audit">
        <TabsList variant="line">
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
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
