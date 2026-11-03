import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Lock } from "lucide-react";
import { Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { can, requireStaff } from "@/lib/admin/guard";
import { isUuid } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TransferOwner } from "./transfer-owner";

export const metadata = { title: "Workspace · Admin · Echo" };

type Detail = {
  id: string; name: string; is_personal: boolean; created_at: string;
  members: { user_id: string; email: string; full_name: string | null; avatar_url: string | null; role: string; joined_at: string; suspended: boolean }[];
  usage: { recordings: number; minutes: number; minutes_month: number; folders: number };
  audit: { action: string; created_at: string; actor: string | null }[] | null;
};

export default async function AdminWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("workspaces.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_workspace_detail", { p_workspace: id });
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const w = data as Detail;
  const nonOwners = w.members.filter((m) => m.role !== "owner").map((m) => ({ user_id: m.user_id, label: m.full_name ? `${m.full_name} (${m.email})` : m.email }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/users" />}><ArrowLeft /> User Management</Button>
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {w.is_personal ? <Lock className="size-5 text-muted-foreground" /> : <Briefcase className="size-5" />}
          {w.is_personal ? `Personal workspace of ${w.members[0]?.email ?? "—"}` : w.name}
        </h1>
        <p className="text-sm text-muted-foreground">{w.is_personal ? "Personal" : "Business"} · created <LocalDate iso={w.created_at} short /></p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Members" value={w.members.length} />
        <StatCard label="Recordings" value={w.usage.recordings} />
        <StatCard label="Minutes" value={w.usage.minutes} hint={`${w.usage.minutes_month} this month`} />
        <StatCard label="Folders" value={w.usage.folders} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <Section title="Members">
          <ul className="divide-y rounded-xl border">
            {w.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 p-3 text-sm">
                <UserAvatar name={m.full_name} email={m.email} src={m.avatar_url} size="sm" />
                <Link href={`/admin/users/${m.user_id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{m.full_name || m.email}</span>
                  {m.full_name && <span className="block truncate text-xs text-muted-foreground">{m.email}</span>}
                </Link>
                {m.suspended && <Badge variant="destructive">Suspended</Badge>}
                <Badge variant="outline">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </Section>

        <div className="space-y-8">
          {!w.is_personal && can(staff, "workspaces.manage") && (
            <Section title="Transfer ownership">
              <TransferOwner workspaceId={w.id} members={nonOwners} />
            </Section>
          )}
          {w.audit && w.audit.length > 0 && (
            <Section title="Admin history">
              <ul className="space-y-2 text-sm">
                {w.audit.map((a, i) => (
                  <li key={i} className="flex justify-between gap-2"><code className="text-xs">{a.action}</code><span className="text-xs text-muted-foreground"><LocalDate iso={a.created_at} short /></span></li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
