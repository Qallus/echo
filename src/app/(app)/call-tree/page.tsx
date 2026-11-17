import { Workflow } from "lucide-react";
import { FlowList } from "@/components/flows/flow-list";
import { requireUser } from "@/lib/data";
import { myFlows } from "@/lib/flows/data";

export const metadata = { title: "Call Tree · Redial" };

// Call flows the person owns or can edit (manage_flows on a line it runs on).
export default async function FlowsPage() {
  const user = await requireUser();
  const flows = await myFlows(user.id);
  return (
    <div className="w-full space-y-6 py-8 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Workflow className="size-7" /> Call Tree</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Build what callers hear and where their calls go: greetings, phone menus, business hours, extensions, your AI assistant and voicemail.</p>
      </div>
      <FlowList flows={flows} />
    </div>
  );
}
