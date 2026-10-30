import { notFound } from "next/navigation";
import { RecordingView } from "@/components/recording/recording-view";
import { getRecordingDetail, listRecordings, listWorkspaces, requireUser } from "@/lib/data";

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, detail, all, workspaces] = await Promise.all([requireUser(), getRecordingDetail(id), listRecordings(), listWorkspaces()]);
  if (!detail) notFound();
  const r = detail.recording;
  const space = workspaces.find((w) => w.id === r.workspaceId)!;
  // Mirrors the database rule: the creator, or an owner/admin of its workspace.
  const canMove = r.createdBy === user.id || space.role === "owner" || space.role === "admin";
  return (
    <RecordingView
      detail={detail}
      list={all.filter((x) => !x.deletedAt && x.workspaceId === r.workspaceId)}
      space={space}
      moveTargets={canMove ? workspaces.filter((w) => w.id !== space.id) : []}
    />
  );
}
