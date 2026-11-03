"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODELS } from "@/lib/ai/models";
import type { ChatMessage, ModelStatus } from "@/hooks/use-echo-chat";
import { cn } from "@/lib/utils";

export function ModelSelect({ value, onChange, models }: { value: string; onChange: (m: string) => void; models: ModelStatus[] }) {
  const list: ModelStatus[] = models.length ? models : MODELS.map((m) => ({ ...m, available: true }));
  return (
    <Select items={list.map((m) => ({ value: m.id, label: m.label }))} value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        {list.map((m) => (
          <SelectItem key={m.id} value={m.id} disabled={!m.available}>
            {m.label}{m.ownKey && <span className="text-xs text-muted-foreground"> · your key</span>}{!m.available && <span className="text-xs text-muted-foreground"> · no key</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function MessageList({ messages, streaming, className, models = [] }: { messages: ChatMessage[]; streaming: boolean; className?: string; models?: ModelStatus[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);
  return (
    <div className={cn("space-y-4", className)}>
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="ml-8 whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">{m.content}</div>
        ) : (
          <div key={i} className="space-y-1">
            <div className="text-xs text-muted-foreground">{[...models, ...MODELS].find((x) => x.id === m.model)?.label ?? "Echo"}</div>
            {m.content ? <Markdown>{m.content}</Markdown> : streaming && <div className="text-sm text-muted-foreground animate-pulse">Thinking…</div>}
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

export function Composer({
  onSend, onStop, streaming, placeholder, model, onModelChange, models, rows = 2,
}: {
  onSend: (text: string) => void; onStop: () => void; streaming: boolean; placeholder: string;
  model: string; onModelChange: (m: string) => void; models: ModelStatus[]; rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const v = ref.current?.value ?? "";
    if (!v.trim()) return;
    onSend(v);
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-2 rounded-xl border bg-background p-2">
      <Textarea
        ref={ref} rows={rows} placeholder={placeholder} className="resize-none border-0 shadow-none focus-visible:ring-0"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
      />
      <div className="flex items-center justify-between">
        <ModelSelect value={model} onChange={onModelChange} models={models} />
        {streaming ? (
          <Button size="icon-sm" variant="secondary" className="rounded-full" onClick={onStop} aria-label="Stop"><Square /></Button>
        ) : (
          <Button size="icon-sm" className="rounded-full" onClick={submit} aria-label="Send"><ArrowUp /></Button>
        )}
      </div>
    </div>
  );
}

export function ChatError({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>;
}
