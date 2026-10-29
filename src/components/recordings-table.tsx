import Link from "next/link";
import { CircleAlert, CircleCheck, Loader2, MoreHorizontal, Phone, Video, Upload, Monitor } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LocalDate } from "@/components/local-date";
import { formatDuration } from "@/lib/format";
import type { Recording } from "@/lib/types";

const sourceIcon = { phone_call: Phone, meeting: Video, upload: Upload, desktop: Monitor };

export function StatusTag({ status }: { status: Recording["status"] }) {
  if (status === "generated")
    return <span className="inline-flex items-center gap-1 text-xs text-sky-600"><CircleCheck className="size-3.5" /> Generated</span>;
  if (status === "processing")
    return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Loader2 className="size-3.5 animate-spin" /> Processing</span>;
  if (status === "failed")
    return <span className="inline-flex items-center gap-1 text-xs text-destructive"><CircleAlert className="size-3.5" /> Failed</span>;
  return null;
}

export function RecordingsTable({ rows, emptyText = "Nothing here yet" }: { rows: Recording[]; emptyText?: string }) {
  if (!rows.length)
    return <div className="py-24 text-center text-sm text-muted-foreground">{emptyText}</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Duration</TableHead>
          <TableHead className="w-48">Date created</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const Icon = sourceIcon[r.source];
          return (
            <TableRow key={r.id}>
              <TableCell className="py-3">
                <Link href={`/recordings/${r.id}`} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="space-y-1">
                    <span className="block max-w-xl truncate font-medium">{r.title}</span>
                    <StatusTag status={r.status} />
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDuration(r.durationSec)}</TableCell>
              <TableCell className="text-muted-foreground"><LocalDate iso={r.createdAt} /></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-sm" aria-label="More"><MoreHorizontal /></Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
