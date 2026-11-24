import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// A feature that has its place in the sidebar but is still being built for
// your workspaces: what it will do, and where to go meanwhile.
export function ComingSoon({ title, what, points, meanwhile }: {
  title: string; what: string; points: string[]; meanwhile?: { href: string; label: string };
}) {
  return (
    <div className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-2">
        <Badge variant="outline" className="gap-1"><Sparkles className="size-3" /> Coming soon</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-muted-foreground">{what}</p>
      </div>
      <ul className="grid max-w-3xl gap-2 sm:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="rounded-xl border bg-card p-4 text-sm">{p}</li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">It works in your Personal and Business workspaces, private to each one.</p>
      {meanwhile && (
        <Button variant="outline" nativeButton={false} render={<Link href={meanwhile.href} />}>{meanwhile.label} <ArrowRight /></Button>
      )}
    </div>
  );
}
