"use client";

import { useRouter } from "next/navigation";
import { Pick } from "@/components/ui/pick";

export function DesignSelect({ recordingId, designs, value }: { recordingId: string; designs: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <Pick label="Design" value={value} onChange={(v) => router.replace(`/recordings/${recordingId}/report${v ? `?design=${v}` : ""}`)}
      className="w-auto" options={[{ value: "", label: "Echo default" }, ...designs.map((d) => ({ value: d.id, label: d.name }))]} />
  );
}
