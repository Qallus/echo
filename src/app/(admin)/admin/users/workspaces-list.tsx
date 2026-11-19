"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, Lock } from "lucide-react";
import { CollectionView } from "@/components/collection/collection-view";
import { LocalDate } from "@/components/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type WorkspaceRow = {
  workspace_id: string; name: string; is_personal: boolean; owner_email: string | null; members: number; recordings: number; created_at: string;
};

const label = (w: WorkspaceRow) => (w.is_personal ? `Personal · ${w.owner_email ?? "no owner"}` : w.name);
const icon = (w: WorkspaceRow) => (
  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">{w.is_personal ? <Lock className="size-4 text-muted-foreground" /> : <Briefcase className="size-4" />}</span>
);

// Every workspace (personal and business); each opens its admin page.
export function WorkspacesList({ workspaces }: { workspaces: WorkspaceRow[] }) {
  const router = useRouter();
  return (
    <CollectionView<WorkspaceRow>
      items={workspaces} getId={(w) => w.workspace_id} title={label} noun={["workspace", "workspaces"]} storageKey="admin-workspaces" defaultView="table"
      subtitle={(w) => (w.is_personal ? "Personal workspace" : `Owner: ${w.owner_email ?? "none"}`)}
      media={icon}
      badge={(w) => <Badge variant="outline">{w.is_personal ? "Personal" : "Business"}</Badge>}
      meta={(w) => <>{w.members} members · {w.recordings} recordings</>}
      searchText={(w) => `${w.name} ${w.owner_email ?? ""}`}
      filters={[
        { id: "business", label: "Business", test: (w) => !w.is_personal },
        { id: "personal", label: "Personal", test: (w) => w.is_personal },
        { id: "all", label: "All", test: () => true },
      ]}
      date={(w) => w.created_at}
      columns={[
        { id: "name", label: "Workspace", sort: (w) => label(w).toLowerCase(), cell: (w) => <span className="flex items-center gap-2.5">{icon(w)}<span className="font-medium">{w.is_personal ? "Personal" : w.name}</span></span> },
        { id: "owner", label: "Owner", sort: (w) => w.owner_email, cell: (w) => <span className="text-muted-foreground">{w.owner_email ?? "—"}</span> },
        { id: "members", label: "Members", sort: (w) => w.members, cell: (w) => <span className="tabular-nums">{w.members}</span> },
        { id: "recordings", label: "Recordings", sort: (w) => w.recordings, cell: (w) => <span className="tabular-nums">{w.recordings}</span> },
        { id: "created", label: "Created", sort: (w) => w.created_at, cell: (w) => <span className="text-muted-foreground"><LocalDate iso={w.created_at} short /></span> },
      ]}
      actions={[{ label: "Open", icon: ExternalLink, single: true, run: ([w]) => router.push(`/admin/workspaces/${w.workspace_id}`) }]}
      previewActions={(w) => <Button size="sm" nativeButton={false} render={<Link href={`/admin/workspaces/${w.workspace_id}`} />}><ExternalLink /> Open workspace</Button>}
      preview={(w) => (
        <dl className="divide-y rounded-xl border px-3 text-sm">
          {([["Type", w.is_personal ? "Personal" : "Business"], ["Owner", w.owner_email ?? "None"], ["Members", String(w.members)], ["Recordings", String(w.recordings)],
            ["Created", <LocalDate key="c" iso={w.created_at} />]] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
    />
  );
}
