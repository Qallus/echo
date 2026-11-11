import Link from "next/link";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { PortView, type PortRow } from "@/components/redial/port-form";
import { Button } from "@/components/ui/button";
import { getMyProfile, requireUser } from "@/lib/data";
import { myLines } from "@/lib/redial/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Bring your number · Echo" };

// Requests to move (port) an existing number to Redial.
export default async function PortPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [lines, profile, { data }] = await Promise.all([
    myLines(),
    getMyProfile(),
    supabase.from("redial_port_requests").select("id, number, carrier, status, foc_date, staff_note, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/calls/phones" />}><ArrowLeft /> Phones</Button>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><ArrowRightLeft className="size-7" /> Bring your number</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Move a mobile, landline or business number you already have to Redial, so callers keep dialing the number they know. Transfers usually take 1 to 2 weeks.</p>
      </div>
      <PortView lines={lines.filter((l) => l.access.owner).map((l) => ({ id: l.id, label: l.label, number: l.number }))} requests={(data ?? []) as PortRow[]} defaultName={profile.fullName ?? ""} />
    </div>
  );
}
