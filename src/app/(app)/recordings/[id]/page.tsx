import { notFound } from "next/navigation";
import { RecordingView } from "@/components/recording/recording-view";
import { getRecordingDetail, listMembers, listRecordings, listWorkspaces, requireUser } from "@/lib/data";
import { audioUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, detail, all, workspaces] = await Promise.all([requireUser(), getRecordingDetail(id), listRecordings(), listWorkspaces()]);
  if (!detail) notFound();
  const r = detail.recording;
  const space = workspaces.find((w) => w.id === r.workspaceId)!;
  // Mirrors the database rule: the creator, or an owner/admin of its workspace.
  const canMove = r.createdBy === user.id || space.role === "owner" || space.role === "admin";
  const supabase = await createClient();
  const { data: file } = await supabase.from("recordings").select("storage_path, processing_error").eq("id", r.id).single();
  const [src, people] = await Promise.all([audioUrl(supabase, file?.storage_path ?? null), listMembers(r.workspaceId).catch(() => [])]);
  return (
    <RecordingView
      detail={detail}
      list={all.filter((x) => !x.deletedAt && x.workspaceId === r.workspaceId)}
      space={space}
      moveTargets={canMove ? workspaces.filter((w) => w.id !== space.id) : []}
      audioSrc={src}
      processingError={file?.processing_error ?? null}
      people={people}
    />
  );
}
