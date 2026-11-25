import Link from "next/link";
import { ArrowRightLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data";
import { myLines } from "@/lib/redial/data";
import { createClient } from "@/lib/supabase/server";
import { NumbersList, type NumberRow } from "./numbers-list";

export const metadata = { title: "Phone numbers · Redial" };

// Phone number manager: every Redial number you own or were given, and
// numbers on their way to Redial (porting).
export default async function NumbersPage() {
  await requireUser();
  const supabase = await createClient();
  const [lines, ports] = await Promise.all([
    myLines(),
    supabase.from("redial_port_requests").select("id, number, carrier, status, created_at").order("created_at", { ascending: false }),
  ]);
  const rows: NumberRow[] = [
    ...lines.map((l) => ({
      id: l.id, kind: "line" as const, number: l.number, label: l.label, mode: l.mode, forwardTo: l.forward_to, paused: l.paused,
      owner: l.access.owner, assistant: l.assistant_name, status: l.paused ? "Paused" : "Active",
    })),
    ...((ports.data ?? []) as { id: string; number: string; carrier: string; status: string; created_at: string }[])
      .filter((p) => !["completed", "cancelled"].includes(p.status))
      .map((p) => ({ id: `port-${p.id}`, kind: "port" as const, number: p.number, label: `Moving from ${p.carrier}`, mode: null, forwardTo: null, paused: false, owner: true, assistant: null, status: p.status.replace(/_/g, " ") })),
  ];
  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-md:sr-only">
          <h1 className="text-2xl font-semibold tracking-tight">Phone numbers</h1>
          <p className="text-sm text-muted-foreground">Your Redial numbers, where their calls go, and numbers you&apos;re moving to Redial.</p>
        </div>
        <div className="slide-row flex gap-2 max-md:w-full">
          <Button variant="outline" nativeButton={false} render={<Link href="/calls/port" />}><ArrowRightLeft /> Connect an existing number</Button>
          <Button nativeButton={false} render={<Link href="/calls/numbers/new" />}><Plus /> Add a number</Button>
        </div>
      </div>
      <NumbersList rows={rows} />
    </div>
  );
}
