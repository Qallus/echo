import Link from "next/link";
import { AdminPage, Section, StatCard } from "@/components/admin/admin-ui";
import { LocalDate } from "@/components/local-date";
import { can, requireStaff } from "@/lib/admin/guard";
import { gatewayConfig } from "@/lib/redial/gateway";
import { redialUsage, type RedialUsage } from "@/lib/redial/usage";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { AssignLine, RemoveLine, RoutingSwitch, SipSetup } from "./line-forms";
import { sipConfig } from "@/lib/comms/sip";
import { SetupQueue, type SetupRow } from "./setup-queue";

export const metadata = { title: "Redial · Admin · Echo" };

type Row = { id: string; owner_id: string; owner_email: string; owner_name: string | null; label: string; number: string; has_destination: boolean; mode: string; paused: boolean; calls_30d: number; last_call_at: string | null };
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

// Redial lines: which member has which number, and whether screening is
// ready. Staff see counts only, never what callers said.
export default async function RedialAdminPage() {
  const staff = await requireStaff("users.view");
  const supabase = await createClient();
  const [{ data, error }, gw, { data: routing }, { data: setups }, sip] = await Promise.all([
    supabase.rpc("admin_redial_lines"), gatewayConfig(), supabase.from("redial_lines").select("id, live_routing"), supabase.rpc("admin_redial_setups"), sipConfig(),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const usage = new Map<string, RedialUsage | null>(await Promise.all([...new Set(rows.map((r) => r.owner_id))].map(async (id) => [id, await redialUsage(supabase, id)] as const)));
  const manage = can(staff, "users.manage");
  const live = new Set((routing ?? []).filter((r) => r.live_routing).map((r) => r.id));

  return (
    <AdminPage title="Redial" description="AI call screening lines. Call content stays private to each member.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Waiting for a number" value={((setups ?? []) as SetupRow[]).filter((x) => x.status === "submitted").length} />
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

      <Section title="Desk phones (SIP)" description="Desk, cordless and Wi-Fi phones sign in to one Twilio SIP domain; each phone gets its own login from the member's Phones page.">
        {can(staff, "settings.manage") ? <SipSetup domain={sip.domain} /> : <p className="text-sm text-muted-foreground">{sip.domain ?? "Not set up yet."}</p>}
      </Section>

      <Section title="Setup requests" description="Members' answers from the setup wizard. Assigning a number applies them to the new line.">
        <SetupQueue rows={((setups ?? []) as SetupRow[]).filter((x) => x.status !== "active")} manage={manage} />
      </Section>

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
                  {!r.has_destination && " · no ring number"} · {r.calls_30d} calls
                  {usage.get(r.owner_id) && ` · ${usage.get(r.owner_id)!.used_minutes}/${usage.get(r.owner_id)!.allowance} min${usage.get(r.owner_id)!.free ? " (free)" : ""}`}{r.last_call_at && <> · last <LocalDate iso={r.last_call_at} short /></>}
                </span>
                {manage ? <RoutingSwitch id={r.id} on={live.has(r.id)} ready={Boolean(gw.aiApp)} /> : live.has(r.id) && <span className="text-xs text-muted-foreground">Conference</span>}
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
          <div className="space-y-1 rounded-xl border p-4 text-sm">
            <p className="font-medium">Conference routing (the AI joins as its own participant):</p>
            <p className="text-muted-foreground">Create a TwiML App in Twilio with Voice Request URL, POST: <code className="break-all">{siteUrl("/api/webhooks/twilio/redial/agent")}</code></p>
            <p className="text-muted-foreground">
              Put its SID (AP…) in <Link href="/admin/settings?tab=integrations" className="underline">Settings → Integrations → Redial</Link>
              {gw.aiApp ? " (set)" : " (not set yet)"}, then turn on Conference for a line above. Lines without it keep the direct path.
              The same app lets members listen live from the browser, which also needs the Twilio API key and secret in Integrations.
            </p>
          </div>
        </Section>
      )}
    </AdminPage>
  );
}
