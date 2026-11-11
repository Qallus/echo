"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/ui/pick";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateRecordingSummary } from "@/lib/actions";
import { CategorySlider, type CategoryFilter } from "@/components/templates/category-slider";
import { FILTERS, filterTemplates, TemplateCard } from "@/components/templates/template-gallery";
import { TEMPLATES } from "@/lib/templates";

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Japanese", "Korean", "Chinese (Simplified)", "Hindi", "Arabic"];

type ModelStatus = { id: string; label: string; available: boolean };

// The "+" next to the recording tabs: pick a template, model and language,
// then generate a summary, action items and highlights.
export function TemplatePicker({ recordingId, open, onOpenChange, current }: { recordingId: string; open: boolean; onOpenChange: (o: boolean) => void; current?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<CategoryFilter>("Recommended");
  const [picked, setPicked] = useState(() => TEMPLATES.find((t) => t.name === current)?.id ?? "adaptive");
  const [model, setModel] = useState("auto");
  const [language, setLanguage] = useState("English");
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || models.length) return;
    fetch("/api/models").then((r) => r.json()).then(setModels).catch(() => {});
  }, [open, models.length]);

  const shown = filterTemplates(query, group);

  const generate = () => start(async () => {
    setError(undefined);
    const res = await generateRecordingSummary(recordingId, picked, model === "auto" ? undefined : model, language);
    if (res.error) return setError(res.error);
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent title="Select a template" description="Echo writes the summary, action items and highlights in this format."
        className="flex h-[min(90svh,48rem)] max-w-5xl flex-col gap-0 space-y-0 p-0 [&>div:first-child]:border-b [&>div:first-child]:p-5">
        <div className="space-y-3 border-b p-4">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “minutes”" className="pl-8" aria-label="Search templates" />
          </div>
          <CategorySlider categories={FILTERS} value={query.trim() ? null : group} onChange={(g) => { setGroup(g); setQuery(""); }} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {shown.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No templates match “{query}”.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((t) => (
                <TemplateCard key={t.id} t={t} active={picked === t.id} onClick={() => setPicked(t.id)} onDoubleClick={() => { setPicked(t.id); generate(); }} />
              ))}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t p-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden />
            <Pick label="AI model" value={model} onChange={setModel} className="w-auto"
              options={[{ value: "auto", label: "Auto" }, ...models.filter((m) => m.available).map((m) => ({ value: m.id, label: m.label }))]} />
          </div>
          <Pick label="Language" value={language} onChange={setLanguage} className="w-auto"
            options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
          <div className="ml-auto flex items-center gap-3">
            {pending && <span className="text-sm text-muted-foreground">Writing your summary… up to a minute</span>}
            <Button onClick={generate} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Wand2 />} Generate now</Button>
          </div>
          {error && <p className="w-full text-sm text-destructive">{error}</p>}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
