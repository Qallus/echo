import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryDocument } from "@/components/designs/summary-document";
import { PrintButton } from "@/components/print-button";
import { getRecordingDetail, listDesigns, listWorkspaces } from "@/lib/data";
import { mergeValues, toSummaryData } from "@/lib/designs/preview";
import { DEFAULT_DESIGN, normalizeDesign } from "@/lib/designs/schema";
import { siteOrigin } from "@/lib/site";
import { DesignSelect } from "./design-select";

export const metadata = { title: "Branded summary · Echo" };

// A recording's summary in one of your designs, ready to print or save as PDF.
export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ design?: string }> }) {
  const [{ id }, { design: designId }] = await Promise.all([params, searchParams]);
  const [detail, designs, workspaces] = await Promise.all([getRecordingDetail(id), listDesigns(), listWorkspaces()]);
  if (!detail) notFound();
  const chosen = designs.find((d) => d.id === designId) ?? designs.find((d) => d.isDefault) ?? null;
  const design = chosen ? normalizeDesign(chosen.config) : DEFAULT_DESIGN;
  const ws = workspaces.find((w) => w.id === detail.recording.workspaceId);
  const listen = `${await siteOrigin()}/recordings/${id}`;

  return (
    <div className="min-h-full">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 print:hidden sm:px-6">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/recordings/${id}`} />}><ArrowLeft /> Recording</Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {designs.length > 0
            ? <DesignSelect recordingId={id} designs={designs.map((d) => ({ id: d.id, name: d.name }))} value={chosen?.id ?? ""} />
            : <span className="text-sm text-muted-foreground">Echo default design</span>}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={chosen?.mine ? `/templates/designs/${chosen.id}` : "/templates/designs/new"} />}>
            <Palette /> {chosen?.mine ? "Edit design" : "New design"}
          </Button>
          <PrintButton />
        </div>
      </div>
      {detail.summary ? (
        <SummaryDocument design={design} data={toSummaryData(detail, listen)} values={mergeValues(detail, ws ? (ws.isPersonal ? "Personal" : ws.name) : "")} />
      ) : (
        <p className="py-24 text-center text-sm text-muted-foreground">This recording has no summary yet. Generate one from the recording page first.</p>
      )}
    </div>
  );
}
