import Link from "next/link";
import { AudioLines, Bot, Plug, Workflow } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadSampleButton } from "@/components/load-sample-button";
import { RecordingsTable } from "@/components/recordings-table";
import { listFolders, listRecordings, listWorkspaces } from "@/lib/data";

const highlights = [
  { icon: Bot, title: "AI Agents", desc: "Agents that act on every call: follow-ups, tasks, CRM updates.", href: "/explore" },
  { icon: Workflow, title: "AutoFlow", desc: "Rules that auto-transcribe, summarize and route new recordings.", href: "/explore" },
  { icon: Plug, title: "MCP & API", desc: "Give Claude, ChatGPT, Grok and Kimi full call context.", href: "/explore" },
];

export default async function HomePage() {
  const [all, workspaces, folders] = await Promise.all([listRecordings(), listWorkspaces(), listFolders()]);
  const recent = all.filter((r) => !r.deletedAt).slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-6 py-10">
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Recent files</h1>
          {recent.length > 0 && <Link href="/library/all" className="text-sm text-muted-foreground hover:text-foreground">View all ›</Link>}
        </div>
        {recent.length ? (
          <RecordingsTable rows={recent} workspaces={workspaces} folders={folders} showSpace={workspaces.length > 1} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <AudioLines className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No recordings yet</p>
              <p className="text-sm text-muted-foreground">Recording and upload arrive in the next step. Load samples to explore Echo now.</p>
            </div>
            {all.length === 0 && <LoadSampleButton />}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">What&apos;s new</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <Icon className="mb-2 size-5" />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
