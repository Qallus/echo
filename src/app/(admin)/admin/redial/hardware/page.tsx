import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminPage, Section } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { HardwareCatalog, ResellerDirectory } from "./hardware-view";

export const metadata = { title: "Hardware · Redial · Admin · Redial" };

// The phones Redial sells or recommends (with dealer prices and margins, staff
// only) and the manufacturers and distributors Redial buys from. The lineup
// is src/lib/redial/hardware.ts; the public page is /phones.
export default async function HardwarePage() {
  await requireStaff("users.view");
  return (
    <AdminPage title="Hardware" description="Phones for Redial lines: what's on the Shop phones page, what it costs us, and where we buy it.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/phones" target="_blank" />}><ExternalLink /> Shop phones page</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/redial" />}>Redial lines</Button>
      </div>
      <Section title="Lineup" description="Prices show on the site as &quot;about&quot; the list price until a Redial price is set. Requests come in through the contact form with the phone filled in.">
        <HardwareCatalog />
      </Section>
      <Section title="Suppliers and reseller programs" description="Apply with the manufacturers, or buy through a distributor. Track your applications in Plans → Jeremy's open items → Phone hardware.">
        <ResellerDirectory />
      </Section>
    </AdminPage>
  );
}
