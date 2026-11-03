import { notFound } from "next/navigation";
import { DocView } from "@/components/admin/workspace/doc-view";
import { can, requireStaff } from "@/lib/admin/guard";
import { crmStaff } from "@/lib/crm/data";
import { getUser, isUuid } from "@/lib/data";
import { getWorkspaceDoc, listWorkspaceComments, listWorkspaceDocs } from "@/lib/workspace/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = isUuid(id) ? await getWorkspaceDoc(id) : null;
  return { title: `${doc?.title ?? "Page"} · Workspace · Echo` };
}

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff("crm.view");
  if (!isUuid(id)) notFound();
  const [doc, docs, comments, people, user] = await Promise.all([getWorkspaceDoc(id), listWorkspaceDocs(), listWorkspaceComments(id), crmStaff(), getUser()]);
  if (!doc || !user) notFound();
  // Mirrors the RLS policies on workspace_docs.
  const mine = doc.created_by === user.id;
  const editor = can(staff, "crm.manage") || can(staff, "projects.manage");
  return (
    <DocView key={doc.id} doc={doc} docs={docs} comments={comments} staff={people} me={user.id}
      editable={mine || (doc.visibility === "team" && editor)}
      canDelete={mine || (doc.visibility === "team" && can(staff, "crm.manage"))}
      canModerate={can(staff, "crm.manage")} />
  );
}
