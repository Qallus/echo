import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Company, Contact, Deal, StaffOption } from "./types";

// CRM reads for Super Admin pages. They run as the signed-in staff member, so
// RLS (crm.view) decides what comes back.

const COMPANY_REF = "company:crm_companies(id, name)";
const CONTACT_REF = "contact:crm_contacts(id, first_name, last_name)";

export const crmStaff = cache(async (): Promise<StaffOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("crm_staff");
  return (data ?? []) as StaffOption[];
});

export async function listCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_companies").select("*").order("name").limit(2000);
  if (error) throw new Error(error.message);
  return data as Company[];
}

export async function getCompany(id: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("crm_companies").select("*").eq("id", id).maybeSingle();
  return data as Company | null;
}

export async function listContacts(filter?: { companyId?: string }): Promise<Contact[]> {
  const supabase = await createClient();
  let q = supabase.from("crm_contacts").select(`*, ${COMPANY_REF}`).order("first_name").limit(5000);
  if (filter?.companyId) q = q.eq("company_id", filter.companyId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Contact[];
}

export async function getContact(id: string): Promise<Contact | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("crm_contacts").select(`*, ${COMPANY_REF}`).eq("id", id).maybeSingle();
  return data as Contact | null;
}

export async function listDeals(filter?: { companyId?: string; contactId?: string }): Promise<Deal[]> {
  const supabase = await createClient();
  let q = supabase.from("crm_deals").select(`*, ${COMPANY_REF}, ${CONTACT_REF}`).order("updated_at", { ascending: false }).limit(2000);
  if (filter?.companyId) q = q.eq("company_id", filter.companyId);
  if (filter?.contactId) q = q.eq("contact_id", filter.contactId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Deal[];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("crm_deals").select(`*, ${COMPANY_REF}, ${CONTACT_REF}`).eq("id", id).maybeSingle();
  return data as Deal | null;
}

// The timeline for a record: its own activities plus those on related
// records (a client's contacts and deals; a contact's deals).
export async function listActivities(target: { companyId?: string; contactIds?: string[]; dealIds?: string[] }): Promise<Activity[]> {
  const parts = [
    target.companyId && `company_id.eq.${target.companyId}`,
    target.contactIds?.length && `contact_id.in.(${target.contactIds.join(",")})`,
    target.dealIds?.length && `deal_id.in.(${target.dealIds.join(",")})`,
  ].filter(Boolean);
  if (!parts.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("crm_activities").select("*").or(parts.join(","))
    .order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return data as Activity[];
}

// Open tasks, soonest due first, for the pipeline page.
export async function openTasks(): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("crm_activities").select("*").eq("kind", "task").is("done_at", null)
    .order("due_at", { ascending: true, nullsFirst: false }).limit(50);
  return (data ?? []) as Activity[];
}
