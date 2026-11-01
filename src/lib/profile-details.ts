// Extra profile fields a user can add under "Additional information".
// Stored as profiles.details (JSON array); teammates see only shared entries.

export type DetailKind = "prefix" | "phone" | "email" | "address" | "website" | "birthday" | "other";
export type ProfileDetail = { kind: DetailKind; label: string; value: string; shared: boolean };

export const PREFIXES = ["Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof."];

export const DETAIL_KINDS: { kind: DetailKind; name: string; label: string; placeholder: string; single?: boolean }[] = [
  { kind: "prefix", name: "Prefix (Mr., Mrs., Ms.…)", label: "Prefix", placeholder: "", single: true },
  { kind: "phone", name: "Phone number", label: "Mobile", placeholder: "+1 555 123 4567" },
  { kind: "email", name: "Email address", label: "Work email", placeholder: "you@example.com" },
  { kind: "address", name: "Address", label: "Office", placeholder: "Street, city, state, ZIP" },
  { kind: "website", name: "Website or social link", label: "Website", placeholder: "example.com" },
  { kind: "birthday", name: "Birthday", label: "Birthday", placeholder: "", single: true },
  { kind: "other", name: "Custom field", label: "", placeholder: "Value" },
];

export const MAX_DETAILS = 20;
export const MAX_VALUE = { address: 300, other: 200 } as Partial<Record<DetailKind, number>>;

export const prefixOf = (details: ProfileDetail[]) => details.find((d) => d.kind === "prefix")?.value ?? null;

// Rows from the database (or a form) -> well-formed details; drops anything else.
export function readDetails(raw: unknown): ProfileDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const { kind, label, value, shared } = d as Record<string, unknown>;
    if (!DETAIL_KINDS.some((k) => k.kind === kind) || typeof value !== "string") return [];
    return [{ kind: kind as DetailKind, label: typeof label === "string" ? label : "", value, shared: shared === true }];
  });
}
