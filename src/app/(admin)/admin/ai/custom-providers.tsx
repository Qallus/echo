"use client";

import { useState, useTransition } from "react";
import { Plus, Server, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { addCustomProvider, removeCustomProvider, setCustomProviderEnabled, testCustomProvider } from "@/lib/admin/actions/ai";

export type CustomProvider = { id: string; name: string; base_url: string; model: string; last4: string | null; enabled: boolean };

// Any OpenAI-compatible endpoint: a model on your own server (Ollama, vLLM,
// LM Studio), or another host. Enabled ones appear in customers' model lists.
export function CustomProviders({ providers, readOnly }: { providers: CustomProvider[]; readOnly: boolean }) {
  const [form, setForm] = useState({ name: "", baseUrl: "", key: "", model: "" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => { const res = await fn(); setMsg(res); if (res.ok) after?.(); });

  return (
    <div className="space-y-4">
      {providers.length === 0 && !adding && <p className="rounded-xl border p-4 text-sm text-muted-foreground">No custom providers yet.</p>}
      {providers.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Server className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name} <code className="text-xs text-muted-foreground">{p.model}</code></p>
                <p className="truncate text-xs text-muted-foreground">{p.base_url}{p.last4 ? ` · key ••••${p.last4}` : " · no key"}</p>
              </div>
              {!readOnly && (
                <>
                  <Switch checked={p.enabled} aria-label={`Enable ${p.name}`} disabled={pending} onCheckedChange={(on) => run(() => setCustomProviderEnabled(p.id, on))} />
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => testCustomProvider(p.id))}>Test</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${p.name}`} disabled={pending}
                    onClick={() => confirm(`Remove ${p.name}?`) && run(() => removeCustomProvider(p.id))}><Trash2 /></Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (adding ? (
        <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => {
          e.preventDefault();
          run(() => addCustomProvider(form), () => { setAdding(false); setForm({ name: "", baseUrl: "", key: "", model: "" }); });
        }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input required placeholder="Name, e.g. Echo Local (Llama)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Name" />
            <Input required placeholder="Model, e.g. llama3.3" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} aria-label="Model" />
            <Input required placeholder="Base URL, e.g. https://ai.example.com/v1" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} aria-label="Base URL" />
            <PasswordInput placeholder="API key (if the server needs one)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} aria-label="API key" autoComplete="off" />
          </div>
          <p className="text-xs text-muted-foreground">Ollama: run it with OLLAMA_HOST=0.0.0.0, put it behind HTTPS (or a private network the Echo server can reach), and use the /v1 URL. Echo tests the endpoint before saving.</p>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Testing…" : "Test and add"}</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      ) : <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus /> Add custom provider</Button>)}

      {msg.error && <p className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    </div>
  );
}
