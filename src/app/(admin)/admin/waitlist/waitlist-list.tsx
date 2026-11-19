"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BellRing, Contact, Download, Mail, Send, UserCheck } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setWaitlistStatus } from "@/lib/admin/actions/waitlist";
import { downloadCsv, StatusSelect } from "./waitlist-controls";
import type { Entry } from "./page";

const FREQ: Record<string, string> = { major: "big news only", monthly: "monthly", weekly: "weekly", all: "every update" };
const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const apps = (e: Entry) => e.platforms.map((p) => (p === "ios" ? "iPhone" : "Android")).join(" + ");
const fullName = (e: Entry) => `${e.first_name} ${e.last_name}`.trim();
const initials = (e: Entry) => `${e.first_name[0] ?? ""}${e.last_name[0] ?? ""}`.toUpperCase() || "?";

// People waiting for the mobile apps, in the shared list layout. Each one is
// also a CRM lead (source "App waitlist").
export function WaitlistList({ rows, manage }: { rows: Entry[]; manage: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const setStatus = (list: Entry[], status: string) => start(async () => {
    for (const e of list) { const r = await setWaitlistStatus(e.id, status); if (r.error) { alert(r.error); break; } }
    router.refresh();
  });
  const face = (e: Entry) => <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{initials(e)}</span>;

  return (
    <CollectionView<Entry>
      items={rows} getId={(e) => e.id} title={fullName} noun={["person", "people"]} storageKey="admin-waitlist" defaultView="list"
      subtitle={(e) => `${apps(e)} · ${e.account_type}${e.company ? ` · ${e.company}` : ""}`}
      media={face}
      badge={(e) => <Badge variant="outline" className="capitalize">{e.status}</Badge>}
      meta={(e) => <>{e.consent_sms ? "OK to text" : "No texts"} · {e.consent_call ? "OK to call" : "No calls"} · <LocalDate iso={e.created_at} short /></>}
      searchText={(e) => `${fullName(e)} ${e.email} ${e.phone} ${e.company ?? ""} ${e.use_case ?? ""} ${e.details ?? ""} ${e.questions ?? ""} ${e.status}`}
      filters={[
        { id: "all", label: "Everyone", test: () => true },
        { id: "ios", label: "iPhone", test: (e) => e.platforms.includes("ios") },
        { id: "android", label: "Android", test: (e) => e.platforms.includes("android") },
        { id: "business", label: "Business", test: (e) => e.account_type === "business" },
        { id: "personal", label: "Personal", test: (e) => e.account_type === "personal" },
        { id: "sms", label: "OK to text", test: (e) => e.consent_sms },
        { id: "call", label: "OK to call", test: (e) => e.consent_call },
        { id: "questions", label: "Has a question", test: (e) => Boolean(e.questions) },
      ]}
      date={(e) => e.created_at}
      columns={[
        { id: "name", label: "Name", sort: (e) => fullName(e).toLowerCase(), cell: (e) => <span className="flex items-center gap-2.5">{face(e)}<span className="min-w-0"><span className="block truncate font-medium">{fullName(e)}</span><span className="block truncate text-xs text-muted-foreground">{e.email}</span></span></span> },
        { id: "apps", label: "App", sort: (e) => apps(e), cell: (e) => apps(e) },
        { id: "type", label: "Account", sort: (e) => e.account_type, cell: (e) => <span className="capitalize">{e.account_type}{e.company ? ` · ${e.company}` : ""}</span> },
        { id: "consent", label: "Contact OK", sort: (e) => Number(e.consent_sms) + Number(e.consent_call), cell: (e) => <span className="text-muted-foreground">{[e.consent_sms && "Text", e.consent_call && "Call"].filter(Boolean).join(", ") || "Email only"}</span> },
        { id: "status", label: "Status", sort: (e) => e.status, cell: (e) => <Badge variant="outline" className="capitalize">{e.status}</Badge> },
        { id: "joined", label: "Signed up", sort: (e) => e.created_at, cell: (e) => <span className="text-muted-foreground"><LocalDate iso={e.created_at} short /></span> },
      ]}
      actions={[
        { label: "Email", icon: Mail, run: (list) => { window.location.href = `mailto:?bcc=${list.map((e) => encodeURIComponent(e.email)).join(",")}`; } },
        { label: "Export CSV", icon: Download, run: (list) => downloadCsv(list) },
        ...(manage ? [
          { label: "Mark notified", icon: BellRing, run: (list: Entry[]) => setStatus(list, "notified") },
          { label: "Mark invited", icon: Send, run: (list: Entry[]) => setStatus(list, "invited") },
          { label: "Mark joined", icon: UserCheck, run: (list: Entry[]) => setStatus(list, "joined") },
        ] : []),
      ]}
      previewActions={(e) => e.contact_id && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/contacts/${e.contact_id}`} />}><Contact /> Open lead</Button>}
      preview={(e) => (
        <div className="space-y-4 text-sm">
          {manage
            ? <div className="flex items-center gap-2"><span className="text-muted-foreground">Status</span><StatusSelect id={e.id} status={e.status} /></div>
            : <Badge variant="outline" className="capitalize">{e.status}</Badge>}
          <dl className="divide-y rounded-xl border px-3">
            {([
              ["Email", <a key="e" href={`mailto:${e.email}`} className="hover:underline">{e.email}</a>],
              ["Phone", <a key="p" href={`tel:${e.phone}`} className="hover:underline">{pretty(e.phone)}</a>],
              ["App", apps(e)], ["Account", `${e.account_type}${e.company ? ` · ${e.company}` : ""}${e.team_size ? ` (${e.team_size})` : ""}`],
              ["Wants", e.products.map((p) => (p === "echo" ? "Echo" : "Redial")).join(" and ") || "—"],
              ["Texts", e.consent_sms ? `OK (${FREQ[e.sms_frequency] ?? e.sms_frequency})` : "No"], ["Calls", e.consent_call ? "OK" : "No"],
              ["Topics", e.update_topics.join(", ") || "—"], ["Use", e.use_case ?? "—"], ["Signed up", <LocalDate key="d" iso={e.created_at} />],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
            ))}
          </dl>
          {e.details && <p>{e.details}</p>}
          {e.questions && <p className="rounded-lg bg-muted/60 p-2"><span className="text-xs text-muted-foreground">Question: </span>{e.questions}</p>}
          <p className="text-xs text-muted-foreground">Only text or call if they said OK, no more often than they chose, and only about the topics they picked.</p>
        </div>
      )}
    />
  );
}
