"use client";

import { formatDateTime } from "@/lib/format";

// Shows a timestamp in the viewer's own time zone.
export function LocalDate({ iso, short }: { iso: string; short?: boolean }) {
  const text = formatDateTime(iso);
  return <time dateTime={iso} suppressHydrationWarning>{short ? text.slice(5) : text}</time>;
}
