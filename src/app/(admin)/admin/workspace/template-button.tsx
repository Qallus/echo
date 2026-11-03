"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createWorkspaceDoc } from "@/lib/admin/actions/workspace";

export function TemplateButton({ id, icon, label }: { id: string; icon: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left text-sm font-medium transition hover:border-foreground/20 hover:shadow-sm disabled:opacity-60"
      onClick={() => start(async () => { const r = await createWorkspaceDoc({ template: id }); if (r.id) router.push(`/admin/workspace/${r.id}`); else if (r.error) alert(r.error); })}>
      {pending ? <Loader2 className="size-6 animate-spin" /> : <span aria-hidden className="text-2xl leading-none">{icon}</span>}
      {label}
    </button>
  );
}
