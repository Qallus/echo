import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, PhoneIncoming, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallsView } from "@/components/redial/calls-view";
import { getMyProfile, requireUser } from "@/lib/data";
import { lineDetail, myLines } from "@/lib/redial/data";
import { redialUsage } from "@/lib/redial/usage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calls · Echo" };

// Redial call screening: screened calls and messages, callbacks, rules and
// the assistant, for one of the member's lines.
export default async function CallsPage({ searchParams }: { searchParams: Promise<{ line?: string; call?: string; tab?: string }> }) {
  const user = await requireUser();
  const [{ line: lineId, call, tab }, lines, profile] = await Promise.all([searchParams, myLines(), getMyProfile()]);
  // No line yet: set Redial up first.
  if (!lines.length) redirect("/setup");
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  const [detail, usage] = await Promise.all([lineDetail(line.id, line.access), line.access.owner ? createClient().then((s) => redialUsage(s, user.id)) : Promise.resolve(null)]);
  const pretty = line.number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><PhoneIncoming className="size-7" /> Calls</h1>
          <p className="text-sm text-muted-foreground">
            Your assistant answers <span className="font-medium text-foreground">{pretty}</span>, screens callers and takes messages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {line.access.owner && <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/calls/phones" />}><Phone /> Phones</Button>}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/call-tree" />}><Workflow /> Call Tree</Button>
        </div>
        {lines.length > 1 && (
          <nav aria-label="Lines" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
            {lines.map((l) => (
              <Link key={l.id} href={`/calls?line=${l.id}`} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", l.id === line.id ? "bg-card shadow-sm" : "text-muted-foreground")}>{l.label}</Link>
            ))}
          </nav>
        )}
      </div>
      <CallsView key={line.id} line={line} access={line.access} {...detail} usage={usage} initialCall={call ?? null} initialTab={tab ?? null}
        ownerFirst={profile.fullName?.trim().split(/\s+/)[0] ?? "you"} />
    </div>
  );
}
