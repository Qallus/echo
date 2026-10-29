import { notFound } from "next/navigation";
import { RecordingsTable } from "@/components/recordings-table";
import { listFolders, listRecordings } from "@/lib/data";
import { SOURCES, type Recording } from "@/lib/types";

// Routes: /library/all | unfiled | trash | source/<slug> | folder/<id>
export default async function LibraryPage({ params }: { params: Promise<{ view: string[] }> }) {
  const { view } = await params;
  const [kind, arg] = view;
  const [all, folders] = await Promise.all([listRecordings(), listFolders()]);
  const active = all.filter((r) => !r.deletedAt);

  let data: { title: string; rows: Recording[]; empty?: string } | null = null;
  if (kind === "all") data = { title: "All files", rows: active };
  else if (kind === "unfiled") data = { title: "Unfiled", rows: active.filter((r) => !r.folderId) };
  else if (kind === "trash") data = { title: "Trash", rows: all.filter((r) => r.deletedAt), empty: "Trash is empty" };
  else if (kind === "source") {
    const entry = Object.entries(SOURCES).find(([, s]) => s.slug === arg);
    if (entry) data = { title: entry[1].label, rows: active.filter((r) => r.source === entry[0]) };
  } else if (kind === "folder") {
    const f = folders.find((x) => x.id === arg);
    if (f) data = { title: f.name, rows: active.filter((r) => r.folderId === f.id), empty: "This folder is empty" };
  }
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
      <RecordingsTable rows={data.rows} emptyText={data.empty} />
    </div>
  );
}
