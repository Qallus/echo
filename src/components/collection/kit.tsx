import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Small pieces shared by pages built on CollectionView.

// An icon in a muted tile (the "media" of a row with no photo).
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted", className)}><Icon className="size-4" /></span>;
}

// Label/value rows for a preview panel.
export function DetailList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-xl border px-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
      ))}
    </dl>
  );
}

export const muted = (v: React.ReactNode) => <span className="text-muted-foreground">{v ?? "—"}</span>;
