"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleAlert, KeyRound, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { MODELS } from "@/lib/ai/models";
import { removeAiKey, saveAiKey, setAiKeyModel, testAiKey } from "./actions";

export type KeyRow = { id: string; provider: string; last4: string; model: string | null; status: "ok" | "failed"; last_error: string | null };

const HINTS: Record<string, string> = {
  claude: "console.anthropic.com → API keys", gpt: "platform.openai.com → API keys (also used for transcription)",
  gemini: "aistudio.google.com → Get API key", grok: "console.x.ai → API keys",
  kimi: "platform.moonshot.ai → API keys", openrouter: "openrouter.ai → Keys",
};

// One row per provider: add a key (tested before it's saved), or see the saved
// one (last 4 only), change its model, test it again or remove it.
export function KeysCard({ scope, workspaceId, keys, canEdit, defaults }: {
  scope: "user" | "workspace"; workspaceId?: string; keys: KeyRow[]; canEdit: boolean; defaults: Record<string, string>;
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {MODELS.map((m) => (
        <ProviderRow key={m.id} provider={m.id} label={m.label} scope={scope} workspaceId={workspaceId}
          saved={keys.find((k) => k.provider === m.id)} canEdit={canEdit} defaultModel={defaults[m.id]} />
      ))}
    </ul>
  );
}

function ProviderRow({ provider, label, scope, workspaceId, saved, canEdit, defaultModel }: {
  provider: string; label: string; scope: "user" | "workspace"; workspaceId?: string; saved?: KeyRow; canEdit: boolean; defaultModel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(saved?.model ?? "");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => { const res = await fn(); setMsg(res); if (res.ok) after?.(); });

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
        {saved ? (
          <>
            <code className="text-xs text-muted-foreground">••••{saved.last4}</code>
            {saved.status === "ok"
              ? <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400"><CircleCheck className="size-3" /> Working</Badge>
              : <Badge variant="outline" className="gap-1 text-destructive"><CircleAlert className="size-3" /> Not working</Badge>}
          </>
        ) : <span className="text-xs text-muted-foreground">Using Echo&apos;s key</span>}
        {canEdit && (
          <span className="ml-auto flex gap-1">
            {saved && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => testAiKey(saved.id))}>Test</Button>}
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setAdding((v) => !v)}>{saved ? "Replace" : "Add key"}</Button>
            {saved && (
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${label} key`} disabled={pending}
                onClick={() => confirm(`Remove your ${label} key? Echo's own key is used instead.`) && run(() => removeAiKey(saved.id))}><Trash2 /></Button>
            )}
          </span>
        )}
      </div>

      {saved?.status === "failed" && saved.last_error && <p className="text-xs text-destructive">{saved.last_error}</p>}

      {saved && canEdit && !adding && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setAiKeyModel(saved.id, model)); }}>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={defaultModel ? `Model (default: ${defaultModel})` : "Model"} className="h-8 max-w-xs text-sm" aria-label={`${label} model`} />
          <Button type="submit" size="sm" variant="ghost" disabled={pending || model === (saved.model ?? "")}>Save model</Button>
        </form>
      )}

      {adding && canEdit && (
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          run(() => saveAiKey({ scope, workspaceId, provider, key, model }), () => { setAdding(false); setKey(""); });
        }}>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-56 flex-1">
              <PasswordInput value={key} onChange={(e) => setKey(e.target.value)} placeholder={`${label} API key`} autoComplete="off" aria-label={`${label} API key`} required />
            </div>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={defaultModel ? `Model (default: ${defaultModel})` : "Model (optional)"} className="max-w-56" aria-label={`${label} model`} />
            <Button type="submit" disabled={pending || !key.trim()}>{pending ? "Testing…" : "Test and save"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Get one at {HINTS[provider]}. Echo tests it, then stores it encrypted; only the last 4 characters are ever shown.</p>
        </form>
      )}

      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </li>
  );
}
