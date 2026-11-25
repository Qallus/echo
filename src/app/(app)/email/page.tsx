import { ComingSoon } from "@/components/shell/coming-soon";
import { WorkspaceEmail, type EmailPerson, type EmailTemplate, type SentEmail } from "@/components/email/workspace-email";
import { listWorkspaces, requireUser } from "@/lib/data";
import { listContacts } from "@/lib/crm/data";
import { crmScope, workspaceCrmReady } from "@/lib/crm/scope";
import { columnReady } from "@/lib/schema-ready";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Emails · Redial" };

// Emails to contacts from the chosen workspace: compose, saved templates and
// a sent log. Sent through Redial's email service; replies go to you.
export default async function EmailPage() {
  await requireUser();
  if (!(await columnReady("workspace_emails", "id"))) {
    return <ComingSoon title="Emails" what="Send emails to your contacts with saved templates, and see what was sent."
      points={["Templates you can reuse", "Replies come straight to your inbox", "A sent log per contact", "Email several people, each their own copy"]}
      meanwhile={{ href: "/templates", label: "See your templates" }} />;
  }
  const scope = await crmScope();
  const ws = scope.staff ? null : scope.workspaceId;
  const supabase = await createClient();
  const [sent, templates, contacts, workspaces] = await Promise.all([
    ws ? supabase.from("workspace_emails").select("id, to_email, subject, body, status, error, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1000) : { data: [] },
    ws ? supabase.from("workspace_email_templates").select("id, name, subject, body, updated_at").eq("workspace_id", ws).order("name") : { data: [] },
    (await workspaceCrmReady()) ? listContacts().catch(() => []) : Promise.resolve([]),
    listWorkspaces(),
  ]);
  const people: EmailPerson[] = contacts.filter((c) => c.email)
    .map((c) => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email!, email: c.email! }));
  const here = workspaces.find((w) => w.id === ws);

  return (
    <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-sm text-muted-foreground">Email your contacts from {here ? (here.isPersonal ? "your Personal workspace" : here.name) : "your workspace"}. Replies come to your own email.</p>
      </div>
      <WorkspaceEmail sent={(sent.data ?? []) as SentEmail[]} templates={(templates.data ?? []) as EmailTemplate[]} people={people}
        workspaceName={here ? (here.isPersonal ? "Personal" : here.name) : ""} />
    </div>
  );
}
