import Link from "next/link";
import { LayoutTemplate, Palette, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDesigns } from "@/lib/data";
import { normalizeDesign } from "@/lib/designs/schema";
import { TEMPLATE_CATEGORIES, TEMPLATES } from "@/lib/templates";
import { DesignActions } from "./design-actions";

export const metadata = { title: "Templates · Echo" };

export default async function TemplatesPage() {
  const designs = await listDesigns();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => {
              const c = normalizeDesign(d.config);
              return (
                <div key={d.id} className="overflow-hidden rounded-xl border">
                  <Link href={d.mine ? `/templates/designs/${d.id}` : "#"} className="block" style={{ background: c.page.background }}>
                    <div className="mx-4 mt-4 overflow-hidden rounded-t-md" style={{ background: c.page.content }}>
                      <div className="flex h-12 items-center gap-2 px-3" style={{ background: c.header.background }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- user logo */}
                        {c.logo.url ? <img src={c.logo.url} alt="" className="h-6 w-auto max-w-[6rem] object-contain" /> : <span className="h-2 w-16 rounded" style={{ background: c.header.textColor, opacity: 0.8 }} />}
                      </div>
                      <div className="space-y-1.5 p-3">
                        <span className="block h-2 w-3/4 rounded" style={{ background: c.page.accent }} />
                        <span className="block h-1.5 w-full rounded opacity-30" style={{ background: c.page.text }} />
                        <span className="block h-1.5 w-5/6 rounded opacity-30" style={{ background: c.page.text }} />
                      </div>
                      <div className="h-5" style={{ background: c.footer.background }} />
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.mine ? (d.workspaceId ? "Shared with your team" : "Only you") : "Shared by a teammate"}</p>
                    </div>
                    {d.isDefault && <Badge variant="outline">Default</Badge>}
                    {d.mine && <DesignActions id={d.id} isDefault={d.isDefault} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Summary templates</h2>
          <p className="text-sm text-muted-foreground">What a summary covers for each kind of conversation. Pick one with the + next to a recording&apos;s tabs; every new recording starts with Adaptive.</p>
        </div>
        {TEMPLATE_CATEGORIES.map((cat) => {
          const list = TEMPLATES.filter((t) => t.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">{cat}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <Card key={t.id}>
                    <CardHeader>
                      <LayoutTemplate className="mb-1 size-4 text-muted-foreground" />
                      <CardTitle className="flex items-center gap-2">{t.name}{t.recommended && <Badge variant="outline">Recommended</Badge>}</CardTitle>
                      <CardDescription>{t.bestFor}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-1 text-sm">
                        {t.sections.map((s, i) => (
                          <li key={s} className="flex gap-2"><span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span> {s}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
