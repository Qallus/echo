"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSampleData } from "@/lib/actions";

export function LoadSampleButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      <Button variant="ghost" onClick={() => start(async () => {
        try { await loadSampleData(); } catch (e) { setError((e as Error).message); }
      })} disabled={pending}>
        <Sparkles /> {pending ? "Loading…" : "Load sample recordings"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
