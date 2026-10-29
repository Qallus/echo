import { notFound } from "next/navigation";
import { RecordingView } from "@/components/recording/recording-view";
import { getRecordingDetail, listRecordings } from "@/lib/data";

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, all] = await Promise.all([getRecordingDetail(id), listRecordings()]);
  if (!detail) notFound();
  return <RecordingView detail={detail} list={all.filter((r) => !r.deletedAt)} />;
}
