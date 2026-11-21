"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { importProspects } from "@/lib/admin/actions/prospects";
import { parseProspects } from "@/lib/prospects/import";

const LABELS: Record<string, string> = { business_name: "business name", phone: "phone", website: "website", address: "address", city: "city", state: "state", category: "category" };

// Upload a CSV (only a phone column is required) or paste numbers, one per line.
export function ImportProspects() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parseProspects(text), [text]);
  const headers = useMemo(() => (parsed.mapped ? text.trim().split(/\r?\n/)[0].split(",") : []), [parsed.mapped, text]);
  const close = () => { setOpen(false); setText(""); setResult({}); };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Upload /> Import</Button>
      {open && (
        <ResponsivePanel open onOpenChange={(o) => !o && close()} title="Import prospects" id="prospects-import" defaultWidth={640}
          description="A CSV with a header row (business name, phone, website, address, city, state, category; only phone is required), or numbers pasted one per line.">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="size-4" /> Choose a .csv file
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
          </label>
          <Textarea rows={7} value={text} onChange={(e) => { setText(e.target.value); setResult({}); }} className="font-mono text-xs"
            placeholder={"…or paste here\n(480) 555-0142\nAcme Plumbing, 480-555-0199"} />
          {text.trim() && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{parsed.rows.length}</span> numbers ready{parsed.invalid ? <>, <span className="text-destructive">{parsed.invalid} not valid</span> (skipped)</> : ""}.
                {" "}<span className="text-muted-foreground">Numbers already on the list are skipped when you import.</span>
              </p>
              {parsed.mapped && (
                <div className="flex flex-wrap gap-1.5">
                  {headers.map((h, i) => (
                    <span key={i} className={parsed.mapped![i] ? "rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs" : "rounded-md border px-2 py-0.5 text-xs text-muted-foreground"}>
                      {h.trim() || "(blank)"}{parsed.mapped![i] ? ` → ${LABELS[parsed.mapped![i]!]}` : " → not used"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {(result.ok || result.error) && <p className={result.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{result.error ?? result.ok}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>{result.ok ? "Done" : "Cancel"}</Button>
            {!result.ok && (
              <Button disabled={pending || !parsed.rows.length} onClick={() => start(async () => {
                const r = await importProspects(parsed.rows, parsed.source);
                setResult(r);
                if (r.ok) router.refresh();
              })}>{pending ? "Importing…" : `Import ${parsed.rows.length || ""}`}</Button>
            )}
          </div>
        </ResponsivePanel>
      )}
    </>
  );
}
