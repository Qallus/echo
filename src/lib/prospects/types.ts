import type { Confidence, Provider } from "./carriers";

// A prospect with its cached Twilio lookup (if any).

export const PROSPECT_STATUSES = [
  { id: "new", label: "New" }, { id: "queued", label: "Queued" }, { id: "contacted", label: "Contacted" },
  { id: "demo", label: "Demo" }, { id: "won", label: "Won" }, { id: "lost", label: "Lost" }, { id: "dnc", label: "Do not contact" },
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]["id"];
export const isProspectStatus = (v: unknown): v is ProspectStatus => PROSPECT_STATUSES.some((s) => s.id === v);

export type PhoneLookup = {
  phone_e164: string; valid: boolean | null; line_type: string | null; carrier_name: string | null;
  provider: Provider | null; confidence: Confidence | null; caller_name: string | null; caller_type: string | null;
  error_code: number | null; cost_cents: number; looked_up_at: string;
};

export type Prospect = {
  id: string; business_name: string | null; phone_e164: string; website: string | null; address: string | null;
  city: string | null; state: string | null; category: string | null; source: string; status: ProspectStatus;
  score: number | null; notes: string | null; crm_contact_id: string | null; created_at: string;
  latitude?: number | null; longitude?: number | null; // migration 20261122100000
  lookup: PhoneLookup | null;
};

export const LINE_TYPES: Record<string, string> = {
  landline: "Landline", mobile: "Mobile", fixedVoip: "Fixed VoIP", nonFixedVoip: "Non-fixed VoIP", tollFree: "Toll-free",
  personal: "Personal", premium: "Premium", sharedCost: "Shared cost", uan: "UAN", voicemail: "Voicemail", pager: "Pager", unknown: "Unknown",
};
