import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import type { E911Row } from "@/components/redial/e911-card";
import { PhonesView, type DeviceRow } from "@/components/redial/phones-view";
import { Button } from "@/components/ui/button";
import { e911OnNumber } from "@/lib/comms/e911";
import { sipConfig, sipReady } from "@/lib/comms/sip";
import { getMyProfile, requireUser } from "@/lib/data";
import { myLines } from "@/lib/redial/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Phones · Echo" };

type Db = Awaited<ReturnType<typeof createClient>>;

// The phones, with the newer columns (settings-page link, check-ins) when
// the database has them; older databases fall back step by step.
async function loadDevices(db: Db, ids: string[], cols: string): Promise<DeviceRow[]> {
  if (!ids.length) return [];
  for (const extra of [", web_url, last_seen_at, firmware", ", web_url", ""]) {
    const { data, error } = await db.from("redial_devices").select(`${cols}${extra}`).in("line_id", ids).order("created_at");
    if (!error) return ((data ?? []) as unknown as DeviceRow[]).map((d) => ({ ...d, web_url: d.web_url ?? null, last_seen_at: d.last_seen_at ?? null, firmware: d.firmware ?? null }));
  }
  return [];
}

export default async function PhonesPage() {
  await requireUser();
  const lines = (await myLines()).filter((l) => l.access.owner);
  const supabase = await createClient();
  const ids = lines.map((l) => l.id);
  const cols = "id, line_id, label, model, vendor, mac, sip_username, ring, last_provisioned_at, created_at";
  const [devices, sip, { data: e911 }, profile] = await Promise.all([
    loadDevices(supabase, ids, cols),
    sipConfig(),
    ids.length ? supabase.from("redial_e911").select("line_id, customer_name, street, street2, city, region, postal_code, status, message, updated_at").in("line_id", ids) : Promise.resolve({ data: [] }),
    getMyProfile(),
  ]);
  // Twilio is the record: show the address that's really on each number
  // (even one set outside Redial), and keep Redial's copy in step.
  const saved = (e911 ?? []) as E911Row[];
  const addresses = (await Promise.all(lines.map(async (l): Promise<E911Row | null> => {
    const row = saved.find((x) => x.line_id === l.id) ?? null;
    const now = await e911OnNumber(l.number);
    if (now.error) return row;
    if (!now.address) {
      if (row?.status !== "registered") return row;
      return { ...row, status: "failed", message: "This address isn't on your number anymore. Register it again." };
    }
    const a = now.address;
    const status = now.status === "none" ? "failed" : now.status;
    const live: E911Row = {
      line_id: l.id, customer_name: a.customerName, street: a.street, street2: a.street2 ?? null, city: a.city, region: a.region,
      postal_code: a.postalCode, status, message: now.message ?? null, updated_at: row?.updated_at ?? new Date().toISOString(),
    };
    if (!row || row.status !== status || row.street !== live.street || row.postal_code !== live.postal_code) {
      await supabase.from("redial_e911").upsert({ ...live, updated_at: undefined, address_sid: now.addressSid }, { onConflict: "line_id" });
    }
    return live;
  }))).filter((x): x is E911Row => Boolean(x));
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/calls" />}><ArrowLeft /> Calls</Button>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Phone className="size-7" /> Phones</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Desk, cordless and Wi-Fi phones that ring with your mobile and call out from your Redial number.</p>
      </div>
      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">Set up your Redial line first.</p>
          <p className="mt-1 text-sm text-muted-foreground">Phones belong to a line. Once your line is ready, come back to add them.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/setup" />}>Set up Redial</Button>
        </div>
      ) : (
        <PhonesView lines={lines.map((l) => ({ id: l.id, label: l.label, number: l.number }))} devices={devices} e911={addresses} ownerName={profile.fullName ?? ""} ready={sipReady(sip)} domain={sip.domain} />
      )}
    </div>
  );
}
