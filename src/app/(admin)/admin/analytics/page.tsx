import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-ui";
import { can, requireStaff } from "@/lib/admin/guard";
import { RANGES, isRange, rangeDates } from "@/lib/admin/ranges";
import { loadAnalytics, previousRange } from "@/lib/analytics/report";
import { loadOrganization } from "@/lib/settings/organization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AcquisitionTab } from "./tabs/acquisition";
import { AiTab } from "./tabs/ai";
import { EmailSmsTab } from "./tabs/email-sms";
import { OverviewTab } from "./tabs/overview";
import { ProductTab } from "./tabs/product";
import { SalesTab } from "./tabs/sales";
import { SearchTab } from "./tabs/search";
import { SocialTab } from "./tabs/social";
import type { SpendRow } from "./tabs/spend";
import { TrendsTab } from "./tabs/trends";

export const metadata = { title: "Analytics · Admin · Redial" };

// Where customers come from and what they do: one funnel fed by search, AI
// assistants, social, email, texts, referrals and ads, plus the Redial
// product and sales. Plan: docs/ANALYTICS_PLAN.md.
const TABS = [
  { id: "overview", label: "Overview" }, { id: "acquisition", label: "Acquisition" }, { id: "search", label: "Search" },
  { id: "ai", label: "AI" }, { id: "social", label: "Social" }, { id: "email", label: "Email & SMS" },
  { id: "product", label: "Product" }, { id: "sales", label: "Sales" }, { id: "trends", label: "Trends" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; tab?: string }> }) {
  const staff = await requireStaff("analytics.view");
  const supabase = await createClient();
  const sp = await searchParams;
  const range = isRange(sp.range) && sp.range !== "custom" ? sp.range : "30d";
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "overview";
  const org = await loadOrganization(supabase);
  const { since, until, by } = rangeDates(range, org.timezone);
  const href = (t: string, r: string) => `/admin/analytics?tab=${t}&range=${r}`;
  const manage = can(staff, "settings.manage");

  let body: React.ReactNode;
  if (tab === "trends") body = <TrendsTab supabase={supabase} staff={staff} since={since} until={until} by={by} />;
  else if (tab === "search") body = <SearchTab supabase={supabase} since={since} until={until} canSync={manage} />;
  else if (tab === "sales") body = can(staff, "crm.view") ? <SalesTab supabase={supabase} since={since} until={until} /> : <p className="text-sm text-muted-foreground">Sales needs CRM access.</p>;
  else {
    const { data: a, error } = await loadAnalytics(supabase, since, until);
    if (!a) {
      body = (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {error === "setup"
            ? <>Analytics needs its database tables. Run <code>supabase/migrations/20261123090000_analytics.sql</code> in the Supabase SQL Editor, then reload.</>
            : <>Couldn&apos;t load analytics: {error}</>}
        </div>
      );
    } else if (tab === "overview") {
      const p = previousRange(since, until);
      const prev = (await loadAnalytics(supabase, p.since, p.until)).data;
      body = <OverviewTab a={a} prev={prev} by={by} />;
    } else if (tab === "acquisition") {
      const { data: spend } = await supabase.from("marketing_spend").select("*").order("month", { ascending: false }).limit(100);
      body = <AcquisitionTab a={a} spend={(spend ?? []) as SpendRow[]} canEdit={manage} />;
    } else if (tab === "ai") body = <AiTab supabase={supabase} a={a} canRun={manage} />;
    else if (tab === "social") body = <SocialTab supabase={supabase} a={a} canEdit={manage} />;
    else if (tab === "email") body = can(staff, "comms.view") ? <EmailSmsTab supabase={supabase} a={a} since={since} until={until} /> : <p className="text-sm text-muted-foreground">Email & SMS needs communications access.</p>;
    else body = <ProductTab a={a} />;
  }

  return (
    <AdminPage title="Analytics" description={`${since} to ${until} · ${org.timezone.replace(/_/g, " ")}`}
      actions={
        <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {RANGES.map((r) => (
            <Link key={r.id} href={href(tab, r.id)} aria-current={r.id === range ? "page" : undefined}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", r.id === range ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r.label}</Link>
          ))}
        </nav>
      }>
      <nav aria-label="Analytics sections" className="-mx-4 -mt-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link key={t.id} href={href(t.id, range)} aria-current={t.id === tab ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors", t.id === tab ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </AdminPage>
  );
}
