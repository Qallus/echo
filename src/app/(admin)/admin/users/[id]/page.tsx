import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/admin/guard";
import { roleLabel, type StaffRole } from "@/lib/admin/permissions";
import { findPrice, money } from "@/lib/billing/catalog";
import { isUuid } from "@/lib/data";
import { formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { UserActions } from "./user-actions";

export const metadata = { title: "Customer · Admin · Echo" };

type Detail = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; banned_until: string | null;
  providers: string[]; mfa: boolean; sessions: number;
  profile: { full_name: string | null; avatar_url: string | null; job_title: string | null; company: string | null; phone: string | null;
    timezone: string | null; location: string | null; suspended_at: string | null; suspended_reason: string | null };
  staff_role: StaffRole | null;
  workspaces: { id: string; name: string; is_personal: boolean; role: string; members: number; recordings: number }[];
  usage: { recordings: number; minutes: number; minutes_month: number; mcp_calls_30d: number };
  recent_recordings: { id: string; title: string; source: string; status: string; duration_sec: number; created_at: string }[];
  channels: { kind: string; address: string; verified: boolean }[] | null;
  subscriptions: { id: string; status: string; items: { price_key: string; quantity: number }[]; current_period_end: string | null; cancel_at_period_end: boolean }[] | null;
  orders: { id: string; number: number; status: string; total: number; currency: string; created_at: string }[] | null;
  audit: { action: string; detail: Record<string, unknown>; created_at: string; actor: string | null }[] | null;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

// Customer 360: everything support needs about one account. Recording titles
// only, never transcripts or summaries.
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("users.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user: id });
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const d = data as Detail;
  const p = d.profile;
  const suspended = Boolean(p.suspended_at);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/users" />}><ArrowLeft /> Users</Button>

      <div className="flex flex-wrap items-start gap-4">
        <UserAvatar name={p.full_name} email={d.email} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{p.full_name || d.email}</h1>
          <p className="text-sm text-muted-foreground">{d.email}{[p.job_title, p.company].filter(Boolean).length ? ` · ${[p.job_title, p.company].filter(Boolean).join(", ")}` : ""}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            {d.staff_role && <Badge>{roleLabel(d.staff_role)}</Badge>}
            {suspended && <Badge variant="destructive">Suspended</Badge>}
            {!d.confirmed && <Badge variant="outline">Email not confirmed</Badge>}
            {d.mfa ? <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> 2-step on</Badge>
              : <Badge variant="outline" className="gap-1"><ShieldOff className="size-3" /> 2-step off</Badge>}
          </div>
        </div>
        {can(staff, "users.manage") && <UserActions userId={d.id} email={d.email} suspended={suspended} isStaff={Boolean(d.staff_role)} />}
      </div>

      {suspended && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          Suspended <LocalDate iso={p.suspended_at!} />{p.suspended_reason ? `: ${p.suspended_reason}` : "."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Recordings" value={d.usage.recordings} />
        <StatCard label="Minutes" value={d.usage.minutes} hint={`${d.usage.minutes_month} this month`} />
        <StatCard label="Workspaces" value={d.workspaces.length} />
        <StatCard label="Connector calls (30 days)" value={d.usage.mcp_calls_30d} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Account">
          <dl className="grid grid-cols-2 gap-4 rounded-xl border p-4">
            <Field label="Joined" value={<LocalDate iso={d.created_at} />} />
            <Field label="Last sign-in" value={d.last_sign_in_at ? <LocalDate iso={d.last_sign_in_at} /> : "Never"} />
            <Field label="Sign-in methods" value={d.providers.join(", ")} />
            <Field label="Active sessions" value={d.sessions} />
            <Field label="Phone" value={p.phone} />
            <Field label="Time zone" value={p.timezone?.replaceAll("_", " ")} />
            <Field label="Location" value={p.location} />
            <Field label="User ID" value={<code className="text-xs">{d.id}</code>} />
          </dl>
        </Section>

        <Section title="Workspaces">
          <ul className="divide-y rounded-xl border">
            {d.workspaces.map((w) => (
              <li key={w.id} className="flex items-center gap-3 p-3 text-sm">
                {w.is_personal ? <Lock className="size-4 text-muted-foreground" /> : <Briefcase className="size-4" />}
                <Link href={`/admin/workspaces/${w.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{w.is_personal ? "Personal" : w.name}</Link>
                <Badge variant="outline">{w.role}</Badge>
                <span className="text-xs text-muted-foreground">{w.members} members · {w.recordings} recordings</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Recent recordings" description="Titles only. Staff can't open transcripts or summaries.">
        {d.recent_recordings.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No recordings.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Length</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.recent_recordings.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-xs truncate">{r.title}</TableCell>
                  <TableCell className="text-muted-foreground">{r.source.replace("_", " ")}</TableCell>
                  <TableCell><Badge variant="outline" className={r.status === "failed" ? "text-destructive" : ""}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(r.duration_sec)}</TableCell>
                  <TableCell className="text-muted-foreground"><LocalDate iso={r.created_at} short /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        {d.subscriptions && (
          <Section title="Billing">
            <div className="space-y-3 rounded-xl border p-4 text-sm">
              {d.subscriptions.length === 0 ? <p className="text-muted-foreground">No subscriptions.</p> : d.subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={s.status === "past_due" ? "text-destructive" : ""}>{s.status.replace("_", " ")}</Badge>
                  <span>{s.items.map((i) => `${findPrice(i.price_key)?.product.name ?? i.price_key}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}</span>
                  {s.current_period_end && <span className="text-xs text-muted-foreground">{s.cancel_at_period_end ? "Ends" : "Renews"} <LocalDate iso={s.current_period_end} short /></span>}
                </div>
              ))}
              {d.orders && d.orders.length > 0 && (
                <ul className="space-y-1 border-t pt-3">
                  {d.orders.map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span>Order #{o.number} <span className="text-xs text-muted-foreground">{o.status}</span></span>
                      <span className="tabular-nums">{money(o.total, o.currency)} · <LocalDate iso={o.created_at} short /></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        )}

        {d.channels && (
          <Section title="Notification channels">
            {d.channels.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Only the account email.</p> : (
              <ul className="divide-y rounded-xl border text-sm">
                {d.channels.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 p-3">
                    <Badge variant="outline">{c.kind}</Badge>
                    <span className="min-w-0 flex-1 truncate">{c.kind === "push" ? "Browser or device" : c.address}</span>
                    <span className="text-xs text-muted-foreground">{c.verified ? "Verified" : "Not verified"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>

      {d.audit && (
        <Section title="Admin history" description="Admin actions on this account.">
          {d.audit.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No admin actions yet.</p> : (
            <ul className="divide-y rounded-xl border text-sm">
              {d.audit.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 p-3">
                  <code className="text-xs">{a.action}</code>
                  <span className="text-xs text-muted-foreground">by {a.actor ?? "—"}</span>
                  {typeof a.detail?.reason === "string" && <span className="text-xs">“{a.detail.reason}”</span>}
                  <span className="ml-auto text-xs text-muted-foreground"><LocalDate iso={a.created_at} /></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
