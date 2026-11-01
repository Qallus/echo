import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignBuilder } from "@/components/designs/builder";
import { getDesign, listWorkspaces, requireUser } from "@/lib/data";
import { builderPreview } from "@/lib/designs/preview";
import { DEFAULT_DESIGN, normalizeDesign } from "@/lib/designs/schema";

export const metadata = { title: "Summary Builder · Echo" };

export default async function DesignBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [design, workspaces, preview] = await Promise.all([id === "new" ? null : getDesign(id), listWorkspaces(), builderPreview()]);
  if (id !== "new" && (!design || !design.mine)) notFound();

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/templates" />}><ArrowLeft /> Templates</Button>
          <h1 className="text-2xl font-semibold tracking-tight">Summary Builder</h1>
          <p className="text-sm text-muted-foreground">Brand your summaries step by step. Previewing: {preview.source}.</p>
        </div>
      </div>
      <DesignBuilder
        id={design?.id ?? null}
        initialName={design?.name ?? ""}
        initial={design ? normalizeDesign(design.config) : DEFAULT_DESIGN}
        initialWorkspaceId={design?.workspaceId ?? null}
        initialDefault={design?.isDefault ?? false}
        userId={user.id}
        workspaces={workspaces}
        preview={preview.data}
        values={preview.values}
      />
    </div>
  );
}
