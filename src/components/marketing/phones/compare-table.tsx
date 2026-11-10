import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// A feature comparison. Each cell is yes, no, or a short note, always with a
// text label so the meaning never rests on the icon alone. The first column
// after the feature is the highlighted one (Redial). Scrolls sideways on
// phones.

export type Cell = boolean | string;
export type CompareRow = { feature: string; cells: Cell[] };

function Value({ v }: { v: Cell }) {
  if (v === true) return <span className="inline-flex items-center gap-1.5"><Check className="size-4 shrink-0" />Yes</span>;
  if (v === false) return <span className="inline-flex items-center gap-1.5 text-muted-foreground"><X className="size-4 shrink-0" />No</span>;
  return <span className="inline-flex items-start gap-1.5 text-muted-foreground"><Minus className="mt-0.5 size-4 shrink-0" />{v}</span>;
}

export function CompareTable({ columns, rows, caption }: { columns: string[]; rows: CompareRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Feature</th>
            {columns.map((c, i) => <th key={c} scope="col" className={cn("px-4 py-3 font-medium", i === 0 && "bg-foreground text-background")}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.feature} className="align-top">
              <th scope="row" className="px-4 py-3 text-left font-medium">{r.feature}</th>
              {r.cells.map((v, i) => <td key={i} className={cn("px-4 py-3", i === 0 && "bg-muted/40 font-medium")}><Value v={v} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
