import { Dashboard } from "@/components/dashboard/dashboard";
import { RedialSetupCard } from "@/components/redial/setup/setup-card";
import { workspaceCrmReady } from "@/lib/crm/scope";
import { loadDashboardData, loadDashboardLayout } from "@/lib/dashboard/data";
import { hasLiveAgentProfile } from "@/lib/live-agents/agent-data";

export const metadata = { title: "Home · Redial" };

// Home: your own dashboard. Cards and sections you can move, resize, hide
// and add (components/dashboard). The layout is saved to your account.
export default async function HomePage() {
  const [{ layout, stored }, data, liveAgent, crmReady] = await Promise.all([
    loadDashboardLayout(), loadDashboardData(), hasLiveAgentProfile(), workspaceCrmReady(),
  ]);
  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <Dashboard initial={layout} stored={stored} data={data} liveAgent={liveAgent} crmReady={crmReady}
        slots={{ setup: data.hasLine ? undefined : <RedialSetupCard /> }} />
    </div>
  );
}
