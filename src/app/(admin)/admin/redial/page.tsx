import Link from "next/link";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { can, requireStaff } from "@/lib/admin/guard";
import { gatewayConfig } from "@/lib/redial/gateway";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { AssignLine, RemoveLine } from "./line-forms";

export const metadata = { title: "Redial · Admin · Echo" };

type Row = { id: string; owner_email: string; owner_name: string | null; label: string; number: string; has_destination: boolean; mode: string; paused: boolean; calls_30d: number; last_call_at: string | null };
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

// Redial lines: which member has which number, and whether screening is
// ready. Staff see counts only, never what callers said.
export default async function RedialAdminPage() {
  const staff = await requireStaff("users.view");
  const supabase = await createClient();
  const [{ data, error }, gw] = await Promise.all([supabase.rpc("admin_redial_lines"), gatewayConfig()]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const manage = can(staff, "users.manage");

  return (
    <AdminPage title="Redial" description="AI call screening lines. Call content stays private to each member.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lines" value={rows.length} />
        <StatCard label="Calls (30 days)" value={rows.reduce((n, r) => n + Number(r.calls_30d), 0)} />
        <StatCard label="Voice gateway" value={gw.ready ? "Set up" : "Not set up"} hint={gw.ready ? gw.url : "Unknown callers go to voicemail until it is"} />
        <StatCard label="Needs a ring number" value={rows.filter((r) => !r.has_destination).length} />
      </div>

      {!gw.ready && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          The AI assistant needs the voice gateway: deploy <code>voice-gateway/</code> on Coolify, then add its URL and shared secret (and the xAI key) in{" "}
          <Link href="/admin/settings?tab=integrations" className="underline">Settings → Integrations</Link>.
        </p>
      )}

      <Section title="Lines">
        {rows.length === 0 ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">No lines yet.</p> : (
          <ul className="divide-y rounded-xl border bg-card text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{pretty(r.number)} <span className="font-normal text-muted-foreground">· {r.label}</span></p>
                  <p className="text-xs text-muted-foreground">{r.owner_name ? `${r.owner_name} · ` : ""}{r.owner_email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.paused ? "Paused" : r.mode === "off" ? "Not screening" : r.mode === "all" ? "Screening all" : "Screening unknown"}
                  {!r.has_destination && " · no ring number"} · {r.calls_30d} calls{r.last_call_at && <> · last <LocalDate iso={r.last_call_at} short /></>}
                </span>
                {manage && <RemoveLine id={r.id} number={pretty(r.number)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {manage && (
        <Section title="Assign a number" description="Use a Twilio number on Echo's account that isn't the notification number.">
          <AssignLine />
          <div className="space-y-1 rounded-xl border p-4 text-sm">
            <p className="font-medium">Set these on the number in the Twilio console (Phone Numbers → the number → Voice):</p>
            <p className="text-muted-foreground">A call comes in → Webhook, POST: <code className="break-all">{siteUrl("/api/webhooks/twilio/redial/voice")}</code></p>
            <p className="text-muted-foreground">Call status changes → POST: <code className="break-all">{siteUrl("/api/webhooks/twilio/redial/status")}</code></p>
          </div>
        </Section>
      )}
    </AdminPage>
  );
}
