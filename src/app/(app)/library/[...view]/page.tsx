import { notFound } from "next/navigation";
import { Briefcase, Lock } from "lucide-react";
import { RecordingsTable } from "@/components/recordings-table";
import { listFolders, listRecordings, listWorkspaces } from "@/lib/data";
import { spaceLabel } from "@/lib/format";
import { SOURCES, type Recording, type Workspace } from "@/lib/types";

// Routes:
//   /library/space/<workspaceId>[/unfiled|/trash]   one Business or Personal workspace
//   /library/folder/<id>                             one folder
//   /library/all | unfiled | trash | source/<slug>   across every workspace
export default async function LibraryPage({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  const [kind, arg, sub] = view;
  const [all, folders, workspaces] = await Promise.all([listRecordings(), listFolders(), listWorkspaces()]);
  const active = all.filter((r) => !r.deletedAt);

  type View = { title: string; rows: Recording[]; empty?: string; space?: Workspace; mixed?: boolean; trash?: boolean };
  let data: View | null = null;
  if (kind === "space") {
    const ws = workspaces.find((w) => w.id === arg);
    if (ws) {
      const mine = all.filter((r) => r.workspaceId === ws.id);
      const live = mine.filter((r) => !r.deletedAt);
      if (!sub) data = { title: "All files", rows: live, space: ws };
      else if (sub === "unfiled") data = { title: "Unfiled", rows: live.filter((r) => !r.folderId), space: ws };
      else if (sub === "trash") data = { title: "Trash", rows: mine.filter((r) => r.deletedAt), empty: "Trash is empty", space: ws, trash: true };
    }
  } else if (kind === "folder") {
    const f = folders.find((x) => x.id === arg);
    const ws = f && workspaces.find((w) => w.id === f.workspaceId);
    if (f) data = { title: f.name, rows: active.filter((r) => r.folderId === f.id), empty: "This folder is empty", space: ws };
  } else if (kind === "all") data = { title: "All files", rows: active, mixed: true };
  else if (kind === "unfiled") data = { title: "Unfiled", rows: active.filter((r) => !r.folderId), mixed: true };
  else if (kind === "trash") data = { title: "Trash", rows: all.filter((r) => r.deletedAt), empty: "Trash is empty", mixed: true, trash: true };
  else if (kind === "source") {
    const entry = Object.entries(SOURCES).find(([, s]) => s.slug === arg);
    if (entry) data = { title: entry[1].label, rows: active.filter((r) => r.source === entry[0]), mixed: true };
  }
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div className="space-y-1">
        {data.space && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {data.space.isPersonal ? <Lock className="size-3.5" /> : <Briefcase className="size-3.5" />}
            {data.space.isPersonal ? "Personal · only you" : `Business · ${spaceLabel(data.space)} · shared with your team`}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
      </div>
      <RecordingsTable rows={data.rows} emptyText={data.empty} workspaces={workspaces} folders={folders}
        showSpace={data.mixed && workspaces.length > 1} trash={data.trash} />
    </div>
  );
}
