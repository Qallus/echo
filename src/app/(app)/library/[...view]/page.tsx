import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Briefcase, Lock } from "lucide-react";
import { RecordingsTable } from "@/components/recordings-table";
import { SharedList, type SharedRow } from "@/components/shared/shared-list";
import { LinkTabs } from "@/components/shell/link-tabs";
import { listFolders, listRecordings, listWorkspaces } from "@/lib/data";
import { spaceLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SOURCES, type Recording, type Workspace } from "@/lib/types";

// Routes:
//   /library/space/<workspaceId>[/unfiled|/archive|/trash|/shared]   one workspace, as tabs
//   /library/folder/<id>                                              one folder
//   /library/all | unfiled | archive | trash | source/<slug>          across every workspace
export default async function LibraryPage({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  const [kind, arg, sub] = view;
  const [all, folders, workspaces] = await Promise.all([listRecordings(), listFolders(), listWorkspaces()]);
  // Live files: not in Trash and not archived.
  const isLive = (r: Recording) => !r.deletedAt && !r.archivedAt;
  const isArchived = (r: Recording) => !r.deletedAt && Boolean(r.archivedAt);
  const active = all.filter(isLive);

  type View = { title: string; rows: Recording[]; empty?: string; space?: Workspace; mixed?: boolean; trash?: boolean; archive?: boolean; shared?: boolean };
  let data: View | null = null;
  if (kind === "space") {
    const ws = workspaces.find((w) => w.id === arg);
    if (ws) {
      const mine = all.filter((r) => r.workspaceId === ws.id);
      const live = mine.filter(isLive);
      if (!sub) data = { title: "All files", rows: live, space: ws };
      else if (sub === "unfiled") data = { title: "Unfiled", rows: live.filter((r) => !r.folderId), space: ws };
      else if (sub === "archive") data = { title: "Archive", rows: mine.filter(isArchived), empty: "Nothing archived. Archive files to keep them out of the way without deleting them.", space: ws, archive: true };
      else if (sub === "trash") data = { title: "Trash", rows: mine.filter((r) => r.deletedAt), empty: "Trash is empty", space: ws, trash: true };
      else if (sub === "shared") data = { title: "Shared with me", rows: [], space: ws, shared: true };
    }
  } else if (kind === "folder") {
    const f = folders.find((x) => x.id === arg);
    const ws = f && workspaces.find((w) => w.id === f.workspaceId);
    if (f) data = { title: f.name, rows: active.filter((r) => r.folderId === f.id), empty: "This folder is empty", space: ws };
  } else if (kind === "all") data = { title: "All files", rows: active, mixed: true };
  else if (kind === "unfiled") data = { title: "Unfiled", rows: active.filter((r) => !r.folderId), mixed: true };
  else if (kind === "archive") data = { title: "Archive", rows: all.filter(isArchived), empty: "Nothing archived.", mixed: true, archive: true };
  else if (kind === "trash") data = { title: "Trash", rows: all.filter((r) => r.deletedAt), empty: "Trash is empty", mixed: true, trash: true };
  else if (kind === "source") {
    const entry = Object.entries(SOURCES).find(([, s]) => s.slug === arg);
    if (entry) data = { title: entry[1].label, rows: active.filter((r) => r.source === entry[0]), mixed: true };
  }
  if (!data) notFound();

  // Shared with me is the same list in every workspace's tabs.
  let shared: SharedRow[] = [];
  if (data.shared) {
    const supabase = await createClient();
    shared = ((await supabase.rpc("shared_with_me")).data ?? []) as SharedRow[];
  }

  const ws = kind === "space" ? data.space : undefined;
  const base = ws ? `/library/space/${ws.id}` : "";
  const mine = ws ? all.filter((r) => r.workspaceId === ws.id) : [];
  const tabs = ws ? [
    { href: base, label: "All files", count: mine.filter(isLive).length },
    { href: `${base}/unfiled`, label: "Unfiled", count: mine.filter((r) => isLive(r) && !r.folderId).length },
    { href: `${base}/archive`, label: "Archive", count: mine.filter(isArchived).length },
    { href: `${base}/trash`, label: "Trash", count: mine.filter((r) => r.deletedAt).length },
    { href: `${base}/shared`, label: "Shared with me" },
  ] : null;
  const heading = ws ? (ws.isPersonal ? "Personal files" : `Business files · ${ws.name}`) : data.title;

  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-1 max-md:sr-only">
        {data.space && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {data.space.isPersonal ? <Lock className="size-3.5" /> : <Briefcase className="size-3.5" />}
            {data.space.isPersonal ? "Personal · only you" : `Business · ${spaceLabel(data.space)} · shared with your team`}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
      </div>
      {tabs && <Suspense><LinkTabs label="Files" tabs={tabs} /></Suspense>}
      {data.shared ? (
        shared.length ? <SharedList rows={shared} /> : (
          <p className="py-24 text-center text-sm text-muted-foreground">Nothing shared with you yet. When someone shares a recording with your email, it shows up here.</p>
        )
      ) : (
        <RecordingsTable rows={data.rows} emptyText={data.empty} workspaces={workspaces} folders={folders}
          showSpace={data.mixed && workspaces.length > 1} trash={data.trash} archive={data.archive} />
      )}
    </div>
  );
}
