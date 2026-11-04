"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setWaitlistStatus } from "@/lib/admin/actions/waitlist";
import type { Entry } from "./page";

const STATUSES = ["waiting", "notified", "invited", "joined", "unsubscribed"];

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <select aria-label="Status" value={value} disabled={pending}
      className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs capitalize outline-none focus-visible:border-ring dark:bg-input/30"
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(async () => { const r = await setWaitlistStatus(id, next); if (r.error) { setValue(status); alert(r.error); } });
      }}>
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

const COLUMNS: (keyof Entry)[] = ["first_name", "last_name", "email", "phone", "platforms", "products", "account_type", "company", "team_size",
  "use_case", "details", "questions", "consent_sms", "consent_call", "status", "source_page", "created_at"];
const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v);
  // Quote everything; neutralize spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

// Downloads the rows currently shown as a CSV file.
export function ExportCsv({ rows }: { rows: Entry[] }) {
  return (
    <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => {
      const csv = [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(","))].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `app-waitlist-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    }}><Download /> Export CSV</Button>
  );
}
