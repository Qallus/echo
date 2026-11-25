import Link from "next/link";
import { ArrowRightLeft, AudioLines, Bot, ListOrdered, Monitor, Phone, Plug, Plus, Smartphone, WandSparkles, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InstallAppButton } from "@/components/shell/install-app";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadSampleButton } from "@/components/load-sample-button";
import { QuickStart } from "@/components/recorder/quick-start";
import { RecordingsTable } from "@/components/recordings-table";
import { RedialSetupCard } from "@/components/redial/setup/setup-card";
import { listFolders, listRecordings, listWorkspaces } from "@/lib/data";

const highlights = [
  { icon: Bot, title: "AI Agents", desc: "Your call assistant and AI helpers that answer, route and follow up.", href: "/agents/ai" },
  { icon: Workflow, title: "Call Tree", desc: "Greetings, menus, hours and AI steps for every call.", href: "/call-tree" },
  { icon: Plug, title: "Claude connector", desc: "Work with your recordings and Redial from Claude.", href: "/developer" },
];

// Get started: the actions that set up a phone line and the apps.
const START = [
  { icon: WandSparkles, title: "Get started", desc: "Set up Redial step by step: number, where calls go, screening, your assistant.", href: "/setup" },
  { icon: Smartphone, title: "Purchase a new phone", desc: "Desk phones and mobiles that work with Redial out of the box.", href: "/phones" },
  { icon: ArrowRightLeft, title: "Connect your existing number", desc: "Keep the number people already know and move it to Redial.", href: "/calls/port" },
  { icon: ListOrdered, title: "Phone number manager", desc: "All your numbers, where their calls go, and numbers on the way.", href: "/calls/numbers" },
  { icon: Plus, title: "Add another number", desc: "A second line for the business, a team or a project.", href: "/calls/numbers/new" },
];

export default async function HomePage() {
  const [all, workspaces, folders] = await Promise.all([listRecordings(), listWorkspaces(), listFolders()]);
  const recent = all.filter((r) => !r.deletedAt && !r.archivedAt).slice(0, 5);

  return (
    <div className="w-full space-y-10 py-8 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <RedialSetupCard />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {START.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href} className="flex gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-5" /></span>
              <span><span className="block font-medium">{title}</span><span className="text-sm text-muted-foreground">{desc}</span></span>
            </Link>
          ))}
          <div className="flex gap-3 rounded-2xl border bg-card p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Monitor className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <span className="block font-medium">Download the desktop app</span>
              <span className="text-sm text-muted-foreground">Redial in its own window, in your dock or taskbar.</span>
              <InstallAppButton className="mt-2" />
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-dashed p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Phone className="size-5" /></span>
            <span>
              <span className="flex items-center gap-2 font-medium">Download the mobile app <Badge variant="outline">Coming soon</Badge></span>
              <span className="text-sm text-muted-foreground">Redial for Android and iPhone: calls, texts and recordings in your pocket.</span>
            </span>
          </div>
        </div>
      </section>
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
              <p className="text-sm text-muted-foreground">Record a meeting or call, or drop audio files anywhere on this page.</p>
            </div>
            <QuickStart />
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
