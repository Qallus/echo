import Link from "next/link";
import { Palette, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignsCollection, TemplatesCollection } from "@/components/templates/templates-collections";
import { listDesigns } from "@/lib/data";

export const metadata = { title: "Templates · Redial" };

export default async function TemplatesPage() {
  const designs = await listDesigns();
  return (
    <div className="w-full space-y-12 py-8 sm:py-10 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Summary designs</h1>
            <p className="text-sm text-muted-foreground">Your logo, colors, header and footer on every summary you export or share. Build one step by step, or ask Claude to build it with the Echo connector.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/templates/designs/new" />}><Plus /> New design</Button>
        </div>
        {designs.length === 0 ? (
          <Link href="/templates/designs/new" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center hover:bg-muted/40">
            <Palette className="size-7 text-muted-foreground" />
            <span className="font-medium">Create your first summary design</span>
            <span className="text-sm text-muted-foreground">Add your logo, pick colors and write the footer. Takes two minutes.</span>
          </Link>
        ) : (
          <DesignsCollection designs={designs} />
        )}
      </section>

      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Summary templates</h2>
          <p className="text-sm text-muted-foreground">What a summary covers for each kind of conversation. Pick one with the + next to a recording&apos;s tabs; every new recording starts with Adaptive.</p>
        </div>
        <TemplatesCollection />
      </section>
    </div>
  );
}
