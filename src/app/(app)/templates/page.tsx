import { LayoutTemplate } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TEMPLATES } from "@/lib/templates";

export const metadata = { title: "Templates · Echo" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          How Echo structures a summary for each kind of conversation. Choosing a template per recording arrives with
          summary generation, the next feature after transcription.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <LayoutTemplate className="mb-1 size-4 text-muted-foreground" />
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.bestFor}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1 text-sm">
                {t.sections.map((s, i) => (
                  <li key={s} className="flex gap-2"><span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span> {s}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
