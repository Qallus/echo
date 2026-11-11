import Link from "next/link";
import { notFound } from "next/navigation";
import { Monitor } from "lucide-react";
import { FlowStudio } from "@/components/flows/flow-studio";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data";
import { builderContext, flowForEditing } from "@/lib/flows/data";

export const metadata = { title: "Call Tree · Echo" };

// Call Tree for one flow. The canvas needs a larger screen; phones get a
// pointer back to the list.
export default async function FlowStudioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const flow = /^[0-9a-f-]{36}$/i.test(id) ? await flowForEditing(id) : null;
  if (!flow) notFound();
  const context = await builderContext(flow.id);
  return (
    <>
      <div className="hidden md:block"><FlowStudio initial={flow} context={context} /></div>
      <div className="mx-auto max-w-md space-y-3 px-4 py-16 text-center md:hidden">
        <Monitor className="mx-auto size-8 text-muted-foreground" />
        <p className="font-semibold">Open Call Tree on a computer</p>
        <p className="text-sm text-muted-foreground">Building &ldquo;{flow.name}&rdquo; needs a bigger screen. You can still see your flows on your phone.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/call-tree" />}>Back to Call Tree</Button>
      </div>
    </>
  );
}
