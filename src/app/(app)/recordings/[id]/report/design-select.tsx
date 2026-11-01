"use client";

import { useRouter } from "next/navigation";

export function DesignSelect({ recordingId, designs, value }: { recordingId: string; designs: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <select aria-label="Design" value={value} onChange={(e) => router.replace(`/recordings/${recordingId}/report${e.target.value ? `?design=${e.target.value}` : ""}`)}
      className="h-8 rounded-lg border bg-transparent px-2 text-sm">
      <option value="">Echo default</option>
      {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}
