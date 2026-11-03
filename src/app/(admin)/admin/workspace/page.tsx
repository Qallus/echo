import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { NewPageMenu } from "@/components/admin/workspace/workspace-nav";
import { requireStaff } from "@/lib/admin/guard";
import { crmStaff } from "@/lib/crm/data";
import { ownerName } from "@/lib/crm/types";
import { listWorkspaceDocs } from "@/lib/workspace/data";
import { TEMPLATES } from "@/lib/workspace/templates";
import { TemplateButton } from "./template-button";

export const metadata = { title: "Workspace · Admin · Echo" };

// Workspace home: start from a template, pinned and recent pages, full-text search.
export default async function Workspace({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("crm.view");
  const { q } = await searchParams;
  const [docs, staff] = await Promise.all([listWorkspaceDocs(q), crmStaff()]);
  const pinned = q ? [] : docs.filter((d) => d.pinned);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Workspace</h1>
          <p className="text-sm text-muted-foreground">Shared notes, processes and proposals for the team. Private pages are only visible to you.</p>
        </div>
        <NewPageMenu size="default" />
      </div>

      <form className="relative max-w-md" action="/admin/workspace">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={q ?? ""} placeholder="Search every page…" aria-label="Search pages"
          className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
      </form>

      {!q && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Start from a template</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {TEMPLATES.map((t) => <TemplateButton key={t.id} id={t.id} icon={t.icon} label={t.label} />)}
          </div>
        </section>
      )}

      {pinned.length > 0 && <PageGrid title="Pinned" docs={pinned} staff={staff} />}
      <PageGrid title={q ? `Results for “${q}”` : "Recently edited"} docs={q ? docs : docs.slice(0, 24)} staff={staff}
        empty={q ? "No pages match that search." : "No pages yet. Start from a template above."} />
    </div>
  );
}

function PageGrid({ title, docs, staff, empty }: { title: string; docs: Awaited<ReturnType<typeof listWorkspaceDocs>>; staff: Awaited<ReturnType<typeof crmStaff>>; empty?: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {docs.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</p> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} href={`/admin/workspace/${d.id}`} className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-foreground/20 hover:shadow-sm">
              <span aria-hidden className="text-2xl leading-none">{d.icon ?? "📄"}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium"><span className="truncate">{d.title}</span>{d.visibility === "private" && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Private" />}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {new Date(d.updated_at).toLocaleDateString()}{d.updated_by ? ` · ${ownerName(staff, d.updated_by)}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
