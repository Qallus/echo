import type { SupabaseClient } from "@supabase/supabase-js";

// Your business details (platform_settings "organization"), edited in
// Admin -> Settings -> Organization. Emails use them as {{org_*}} merge
// fields, and the time zone sets what "today" means on the dashboard,
// analytics and reports.

export type Organization = { name: string; legalName: string; email: string; phone: string; address: string; website: string; timezone: string };

export const DEFAULT_ORG: Organization = { name: "Qallus LLC", legalName: "", email: "", phone: "", address: "Arizona", website: "", timezone: "America/Phoenix" };

export function readOrg(value: unknown): Organization {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof Organization, unknown>>;
  const str = (k: keyof Organization) => (typeof v[k] === "string" ? (v[k] as string) : DEFAULT_ORG[k]);
  return { name: str("name"), legalName: str("legalName"), email: str("email"), phone: str("phone"), address: str("address"), website: str("website"), timezone: str("timezone") || DEFAULT_ORG.timezone };
}

export async function loadOrganization(supabase: SupabaseClient): Promise<Organization> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "organization").maybeSingle();
  return readOrg(data?.value);
}

export const orgMergeValues = (o: Organization) => ({ org_name: o.name, org_address: o.address, org_phone: o.phone, org_website: o.website, org_email: o.email });
