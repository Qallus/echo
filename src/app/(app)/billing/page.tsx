import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRecordings, requireUser } from "@/lib/data";
import { formatDuration } from "@/lib/format";

export const metadata = { title: "Billing · Echo" };

export default async function BillingPage() {
  const user = await requireUser();
  const mine = (await listRecordings()).filter((r) => r.createdBy === user.id && !r.deletedAt);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonth = mine.filter((r) => new Date(r.createdAt) >= monthStart);
  const stats = [
    { label: "Recordings this month", value: thisMonth.length },
    { label: "Recorded this month", value: formatDuration(thisMonth.reduce((n, r) => n + r.durationSec, 0)) },
    { label: "Recordings in total", value: mine.length },
    { label: "Recorded in total", value: formatDuration(mine.reduce((n, r) => n + r.durationSec, 0)) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="size-4" /> Plan <Badge variant="outline">Pro (Trial)</Badge></CardTitle>
          <CardDescription>
            Everything is unlocked with unlimited minutes during the trial. Paid plans and payment details arrive in a
            later update; nothing is charged until then.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your usage</CardTitle>
          <CardDescription>Recordings you made, in every workspace (Trash not counted).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
