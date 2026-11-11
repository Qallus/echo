import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { PhonesView, type DeviceRow } from "@/components/redial/phones-view";
import { Button } from "@/components/ui/button";
import { sipConfig, sipReady } from "@/lib/comms/sip";
import { requireUser } from "@/lib/data";
import { myLines } from "@/lib/redial/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Phones · Echo" };

// Desk, cordless and Wi-Fi phones on the member's lines (owners only).
export default async function PhonesPage() {
  await requireUser();
  const lines = (await myLines()).filter((l) => l.access.owner);
  const supabase = await createClient();
  const [{ data }, sip] = await Promise.all([
    lines.length
      ? supabase.from("redial_devices").select("id, line_id, label, model, vendor, mac, sip_username, ring, last_provisioned_at, created_at").in("line_id", lines.map((l) => l.id)).order("created_at")
      : Promise.resolve({ data: [] }),
    sipConfig(),
  ]);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/calls" />}><ArrowLeft /> Calls</Button>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Phone className="size-7" /> Phones</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Desk, cordless and Wi-Fi phones that ring with your mobile and call out from your Redial number. Add a phone, then type its setup address into the phone once.</p>
      </div>
      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">Set up your Redial line first.</p>
          <p className="mt-1 text-sm text-muted-foreground">Phones belong to a line. Once your line is ready, come back to add them.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/setup" />}>Set up Redial</Button>
        </div>
      ) : (
        <PhonesView lines={lines.map((l) => ({ id: l.id, label: l.label, number: l.number }))} devices={(data ?? []) as DeviceRow[]} ready={sipReady(sip)} domain={sip.domain} />
      )}
    </div>
  );
}
