"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  BookOpen, Briefcase, GraduationCap, Handshake, LifeBuoy, Loader2, MessagesSquare, Phone, Search, Sparkles, Star, Stethoscope, Users, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateRecordingSummary } from "@/lib/actions";
import { TEMPLATE_CATEGORIES, TEMPLATES, type TemplateCategory } from "@/lib/templates";
import { cn } from "@/lib/utils";

const ICONS: Record<TemplateCategory, typeof Users> = {
  General: Sparkles, Meeting: Users, Call: Phone, Sales: Handshake, Interview: MessagesSquare,
  Education: GraduationCap, Consulting: Briefcase, Medical: Stethoscope, Support: LifeBuoy, Faith: BookOpen,
};
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Japanese", "Korean", "Chinese (Simplified)", "Hindi", "Arabic"];
const SELECT = "h-9 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type ModelStatus = { id: string; label: string; available: boolean };

// The "+" next to the recording tabs: pick a template, model and language,
// then generate a summary, action items and highlights.
export function TemplatePicker({ recordingId, open, onOpenChange, current }: { recordingId: string; open: boolean; onOpenChange: (o: boolean) => void; current?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"Recommended" | "All" | TemplateCategory>("Recommended");
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

  const q = query.trim().toLowerCase();
  const shown = TEMPLATES.filter((t) =>
    q ? `${t.name} ${t.bestFor} ${t.category}`.toLowerCase().includes(q)
      : group === "Recommended" ? t.recommended : group === "All" ? true : t.category === group);

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
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="space-y-3 border-b p-3 md:w-56 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “minutes”" className="pl-8" aria-label="Search templates" />
            </div>
            <nav className="flex gap-1 overflow-x-auto md:flex-col [scrollbar-width:none]">
              {(["Recommended", "All", ...TEMPLATE_CATEGORIES] as const).map((g) => {
                const Icon = g === "Recommended" ? Star : g === "All" ? Wand2 : ICONS[g];
                return (
                  <button key={g} type="button" onClick={() => { setGroup(g); setQuery(""); }}
                    className={cn("flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                      group === g && !q ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                    <Icon className="size-4" /> {g}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {shown.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No templates match “{query}”.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((t) => {
                  const Icon = ICONS[t.category];
                  const active = picked === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setPicked(t.id)} onDoubleClick={() => { setPicked(t.id); generate(); }}
                      aria-pressed={active}
                      className={cn("flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/40",
                        active && "border-foreground ring-1 ring-foreground")}>
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="font-medium">{t.name}</span>
                      <span className="text-sm text-muted-foreground">{t.bestFor}</span>
                      <span className="mt-auto pt-2 text-xs text-muted-foreground">{t.sections.slice(0, 3).join(" · ")}{t.sections.length > 3 ? " …" : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t p-4">
          <label className="flex items-center gap-1.5 text-sm">
            <Sparkles className="size-4 text-muted-foreground" />
            <span className="sr-only">AI model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className={SELECT} aria-label="AI model">
              <option value="auto">Auto</option>
              {models.filter((m) => m.available).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={SELECT} aria-label="Language">
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
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
