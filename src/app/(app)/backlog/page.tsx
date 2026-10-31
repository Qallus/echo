import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LocalDate } from "@/components/local-date";
import { isUuid, listWorkspaces } from "@/lib/data";
import { AREA_LABEL, AREAS, label, OPEN_STATUSES, PRIORITIES, SOURCE_LABEL, STATUSES, type Status } from "@/lib/backlog";
import { createClient } from "@/lib/supabase/server";
import { Filters, ItemDrawer, NewItemForm, priorityClass, StatusSelect } from "./backlog-ui";

export const metadata = { title: "Backlog · Echo" };

type Search = { status?: string; area?: string; priority?: string; workspace?: string; item?: string };

// Developer backlog: items added here, from Claude on your phone, or by Claude Code.
export default async function BacklogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [workspaces, supabase] = await Promise.all([listWorkspaces(), createClient()]);
  const spaces = Object.fromEntries(workspaces.map((w) => [w.id, w.isPersonal ? "Personal" : w.name]));

  let q = supabase.from("dev_requests").select("id, workspace_id, title, kind, area, priority, status, source, created_at, dev_request_comments(count)");
  if (sp.status === "all") { /* every status */ }
  else if ((STATUSES as readonly string[]).includes(sp.status ?? "")) q = q.eq("status", sp.status!);
  else q = q.in("status", [...OPEN_STATUSES]);
  if ((AREAS as readonly string[]).includes(sp.area ?? "")) q = q.eq("area", sp.area!);
  if ((PRIORITIES as readonly string[]).includes(sp.priority ?? "")) q = q.eq("priority", sp.priority!);
  if (sp.workspace && isUuid(sp.workspace)) q = q.eq("workspace_id", sp.workspace);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);

  const itemHref = (id: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "item" && v) as [string, string][]);
    p.set("item", id);
    return `/backlog?${p}`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Backlog</h1>
        <p className="text-sm text-muted-foreground">Build items from you, Claude on your phone, and Claude Code.</p>
      </div>
      <NewItemForm workspaces={workspaces} />
      <Filters workspaces={workspaces} />

      {data.length ? (
        <ul className="divide-y rounded-lg border">
          {data.map((r) => {
            const comments = (r.dev_request_comments as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={r.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
                <Link href={itemHref(r.id)} scroll={false} className="min-w-0 flex-1">
                  <div className="truncate font-medium hover:underline">{r.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {label(r.kind)} · {AREA_LABEL[r.area as keyof typeof AREA_LABEL] ?? r.area}
                    {workspaces.length > 1 && ` · ${spaces[r.workspace_id] ?? ""}`}
                    {` · ${SOURCE_LABEL[r.source] ?? r.source}`} · <LocalDate iso={r.created_at} short />
                    {comments > 0 && ` · ${comments} comment${comments === 1 ? "" : "s"}`}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={priorityClass[r.priority]}>{label(r.priority)}</Badge>
                  <StatusSelect key={`${r.id}-${r.status}`} id={r.id} status={r.status as Status} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
          Nothing here. Add an item above, or ask Claude: &ldquo;Add a backlog item: dashboard, high priority…&rdquo;
        </p>
      )}

      <ItemDrawer itemId={sp.item && isUuid(sp.item) ? sp.item : null} spaces={spaces} />
    </div>
  );
}
