"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, FileText, Lock, Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createWorkspaceDoc } from "@/lib/admin/actions/workspace";
import type { WorkspaceDocMeta } from "@/lib/workspace/data";
import { TEMPLATES } from "@/lib/workspace/templates";
import { cn } from "@/lib/utils";

// "New page" with a template choice; opens the new page.
export function NewPageMenu({ parentId, label = "New page", size = "sm", variant = "default" }: {
  parentId?: string | null; label?: string; size?: "sm" | "default" | "icon-xs"; variant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const create = (template: string, visibility: "team" | "private" = "team") => start(async () => {
    const r = await createWorkspaceDoc({ template, parent_id: parentId ?? null, visibility });
    if (r.id) router.push(`/admin/workspace/${r.id}`); else if (r.error) alert(r.error);
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size={size} variant={variant} disabled={pending} aria-label={label} />}>
        <Plus />{size !== "icon-xs" && label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {TEMPLATES.map((t) => <DropdownMenuItem key={t.id} onClick={() => create(t.id)}><span aria-hidden>{t.icon}</span> {t.label}</DropdownMenuItem>)}
        <DropdownMenuItem onClick={() => create("blank", "private")}><Lock /> Private page (only you)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Page tree beside the editor: pinned first, then nested pages.
export function WorkspaceNav({ docs }: { docs: WorkspaceDocMeta[] }) {
  const [filter, setFilter] = useState("");
  const pathname = usePathname();
  const ids = new Set(docs.map((d) => d.id));
  const children = (parent: string | null) => docs.filter((d) => (parent ? d.parent_id === parent : !d.parent_id || !ids.has(d.parent_id)))
    .sort((a, b) => a.title.localeCompare(b.title));
  const q = filter.trim().toLowerCase();
  const pinned = docs.filter((d) => d.pinned);

  return (
    <nav aria-label="Workspace pages" className="space-y-3">
      <div className="flex items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a page…" aria-label="Find a page"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
        <NewPageMenu size="icon-xs" variant="outline" />
      </div>
      {q ? (
        <ul className="space-y-0.5">
          {docs.filter((d) => d.title.toLowerCase().includes(q)).map((d) => (
            <li key={d.id}><Link href={`/admin/workspace/${d.id}`} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><span aria-hidden>{d.icon ?? "📄"}</span><span className="truncate">{d.title}</span></Link></li>
          ))}
        </ul>
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <p className="flex items-center gap-1 px-2 pb-1 text-xs font-medium text-muted-foreground"><Pin className="size-3" /> Pinned</p>
              <ul className="space-y-0.5">{pinned.map((d) => (
                <li key={d.id}><Link href={`/admin/workspace/${d.id}`} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm", pathname.endsWith(d.id) ? "bg-accent font-medium" : "hover:bg-muted")}><span aria-hidden>{d.icon ?? "📄"}</span><span className="truncate">{d.title}</span></Link></li>
              ))}</ul>
            </div>
          )}
          <div>
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Pages</p>
            {docs.length ? <ul className="space-y-0.5">{children(null).map((d) => <Row key={d.id} d={d} depth={0} kidsOf={children} pathname={pathname} />)}</ul>
              : <p className="px-2 text-sm text-muted-foreground">No pages yet.</p>}
          </div>
        </>
      )}
    </nav>
  );
}

function Row({ d, depth, kidsOf, pathname }: { d: WorkspaceDocMeta; depth: number; kidsOf: (id: string) => WorkspaceDocMeta[]; pathname: string }) {
  const kids = kidsOf(d.id);
  const active = pathname === `/admin/workspace/${d.id}`;
  const [open, setOpen] = useState(() => active || kids.some((k) => pathname.includes(k.id)));
  return (
    <li>
      <div className={cn("group flex items-center rounded-md text-sm", active ? "bg-accent font-medium" : "hover:bg-muted")} style={{ paddingLeft: depth * 12 }}>
        <button type="button" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen(!open)} className={cn("grid size-6 shrink-0 place-items-center text-muted-foreground", !kids.length && "invisible")}>
          <ChevronRight className={cn("size-3.5 transition", open && "rotate-90")} />
        </button>
        <Link href={`/admin/workspace/${d.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-2">
          <span aria-hidden className="w-4 shrink-0 text-center">{d.icon ?? <FileText className="size-4 text-muted-foreground" />}</span>
          <span className="truncate">{d.title}</span>
          {d.visibility === "private" && <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" aria-label="Private" />}
        </Link>
      </div>
      {open && kids.length > 0 && <ul>{kids.map((k) => <Row key={k.id} d={k} depth={depth + 1} kidsOf={kidsOf} pathname={pathname} />)}</ul>}
    </li>
  );
}
