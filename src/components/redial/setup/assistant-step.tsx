"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { setupGreeting, type AssistantAnswers } from "@/lib/redial/setup";
import { VOICES } from "@/lib/redial/types";
import { cn } from "@/lib/utils";
import { StepActions } from "./step-actions";

// Step 5: the assistant's name, voice and greeting, whether it says it's an
// AI (the person's choice), and what it should know.
export function AssistantStep({ initial, firstName, business }: { initial?: Partial<AssistantAnswers>; firstName: string; business: boolean }) {
  const [name, setName] = useState(initial?.name ?? "DJ");
  const [voice, setVoice] = useState(initial?.voice ?? "ara");
  const [disclose, setDisclose] = useState(initial?.disclose ?? true);
  const [greeting, setGreeting] = useState(initial?.greeting ?? "");
  const [about, setAbout] = useState(initial?.about ?? "");
  const suggested = setupGreeting(name.trim(), firstName, disclose);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">This is who your callers meet. You can change any of it later.</p>

      <div className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Bot className="size-6" /></span>
        <p className="text-sm">&ldquo;{greeting.trim() || suggested}&rdquo;</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="su-aname">Name</Label>
        <Input id="su-aname" maxLength={40} className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Voice</Label>
        <div role="radiogroup" aria-label="Voice" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {VOICES.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={voice === v.id} onClick={() => setVoice(v.id)}
              className={cn("rounded-xl border p-3 text-left transition-colors", voice === v.id ? "border-foreground bg-muted/50" : "hover:bg-muted/40")}>
              <span className="block text-sm font-medium">{v.label}</span>
              <span className="block text-xs text-muted-foreground">{v.detail}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
        <span><span className="block text-sm font-medium">Say it&apos;s an AI assistant</span><span className="block text-sm text-muted-foreground">Your choice. DJ says so in the greeting.</span></span>
        <Switch checked={disclose} onCheckedChange={setDisclose} />
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="su-greet">Greeting <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="su-greet" rows={3} maxLength={500} placeholder={suggested} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="su-about">{business ? "About your business" : "Anything DJ should know"} <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="su-about" rows={5} maxLength={4000} value={about} onChange={(e) => setAbout(e.target.value)}
          placeholder={business
            ? "What you do, your services and prices, where you work, and the questions callers ask most. DJ uses this to answer and decide who to put through."
            : "e.g. Always put through calls from my kids' school. I'm not interested in solar, insurance or extended warranties."} />
      </div>

      <StepActions step={5} values={{ name, voice, disclose, greeting, about }} disabled={!name.trim()} />
    </div>
  );
}
