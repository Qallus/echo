"use client";

import { useMemo, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { importContacts } from "@/lib/admin/actions/crm-people";
import { mapHeaders, parseCsv, rowsToImport } from "@/lib/crm/csv";

// Upload or paste a CSV. Known columns (name, email, phone, company…) map
// automatically; the rest are kept as imported details on each contact.
export function ImportDialog({ onClose, role }: { onClose: () => void; role: "contact" | "lead" }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const rows = useMemo(() => parseCsv(text), [text]);
  const map = rows[0] ? mapHeaders(rows[0]) : [];
  const records = useMemo(() => rowsToImport(rows), [rows]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={role === "lead" ? "Import leads" : "Import contacts"} description="CSV with a header row. Name, email, phone, company, title, city, state, website, source, tags and notes map automatically."
        className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="size-4" /> Choose a .csv file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        </label>
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste CSV here" className="font-mono text-xs" />
        {rows[0] && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">{records.length}</span> rows found.</p>
            <div className="flex flex-wrap gap-1.5">
              {rows[0].map((h, i) => (
                <span key={i} className={map[i] ? "rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs" : "rounded-md border px-2 py-0.5 text-xs text-muted-foreground"}>
                  {h || "(blank)"}{map[i] ? ` → ${map[i]!.replace("_", " ")}` : " → detail"}
                </span>
              ))}
            </div>
          </div>
        )}
        {(result.ok || result.error) && <p className={result.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{result.error ?? result.ok}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{result.ok ? "Done" : "Cancel"}</Button>
          {!result.ok && <Button disabled={pending || !records.length} onClick={() => start(async () => setResult(await importContacts(records, role)))}>
            {pending ? "Importing…" : `Import ${records.length || ""}`}
          </Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
