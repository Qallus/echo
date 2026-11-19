"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Repeat, UserRound } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { downloadCsv } from "@/components/admin/list-csv";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/billing/catalog";

// One subscription, with its plan names and monthly value worked out on the server.
export type SubListRow = {
  id: string; user_id: string; user_email: string | null; status: string; plan: string; monthly: number;
  current_period_end: string | null; cancel_at_period_end: boolean; created_at: string;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const status = (x: SubListRow) => <Badge variant="outline" className={x.status === "past_due" ? "text-destructive" : ""}>{x.status.replace("_", " ")}{x.cancel_at_period_end ? " · ending" : ""}</Badge>;
const icon = () => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Repeat className="size-4" /></span>;

// Admin → Billing → Subscriptions, in the shared list layout.
export function SubscriptionsList({ subs }: { subs: SubListRow[] }) {
  const router = useRouter();
  return (
    <CollectionView<SubListRow>
      items={subs} getId={(x) => x.id} title={(x) => x.user_email ?? "—"} subtitle={(x) => x.plan} media={icon} badge={status}
      noun={["subscription", "subscriptions"]} storageKey="admin-billing-subscriptions" defaultView="table" empty="No subscriptions yet."
      meta={(x) => <>{money(x.monthly)}/mo · renews {when(x.current_period_end)}</>}
      searchText={(x) => `${x.user_email ?? ""} ${x.plan} ${x.status}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        { id: "active", label: "Active", test: (x) => x.status === "active" || x.status === "trialing" },
        { id: "past_due", label: "Past due", test: (x) => x.status === "past_due" },
        { id: "ending", label: "Ending", test: (x) => x.cancel_at_period_end },
        { id: "canceled", label: "Cancelled", test: (x) => x.status === "canceled" },
      ]}
      date={(x) => x.current_period_end}
      columns={[
        { id: "customer", label: "Customer", sort: (x) => x.user_email, cell: (x) => <span className="font-medium">{x.user_email ?? "—"}</span> },
        { id: "plan", label: "Plan and add-ons", sort: (x) => x.plan, cell: (x) => <span className="text-muted-foreground">{x.plan}</span> },
        { id: "status", label: "Status", sort: (x) => x.status, cell: status },
        { id: "monthly", label: "Monthly value", sort: (x) => x.monthly, className: "text-right tabular-nums", cell: (x) => money(x.monthly) },
        { id: "renews", label: "Renews", sort: (x) => x.current_period_end, cell: (x) => <span className="text-muted-foreground">{when(x.current_period_end)}</span> },
      ]}
      actions={[
        { label: "Customer", icon: UserRound, single: true, run: ([x]) => router.push(`/admin/users/${x.user_id}`) },
        { label: "Export", icon: Download, run: (rows) => downloadCsv("subscriptions.csv", ["Customer", "Plan", "Status", "Monthly", "Renews", "Ending"],
          rows.map((x) => [x.user_email, x.plan, x.status, (x.monthly / 100).toFixed(2), x.current_period_end, x.cancel_at_period_end ? "yes" : "no"])) },
      ]}
      preview={(x) => (
        <dl className="divide-y rounded-xl border px-3 text-sm">
          {[["Customer", <Link key="c" href={`/admin/users/${x.user_id}`} className="hover:underline">{x.user_email ?? "—"}</Link>], ["Plan", x.plan],
            ["Status", `${x.status.replace("_", " ")}${x.cancel_at_period_end ? " (ends at period end)" : ""}`], ["Monthly value", money(x.monthly)],
            ["Renews", when(x.current_period_end)], ["Started", when(x.created_at)]].map(([k, v]) => (
            <div key={String(k)} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
          ))}
        </dl>
      )}
    />
  );
}
